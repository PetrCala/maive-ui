# Request-level wall-clock bounds for the model routes (#526)
#
# On Aug 15, 67 requests ran all the way to the platform's 600 s function
# timeout and were hard-killed, burning ~139k GB-seconds and returning nothing
# to their callers. The RTMA fit already ran under a bounded child process
# (rtma_model.R), but that guard covers one fit, not the request: MAIVE runs,
# bootstrap standard errors, plot rendering and JSON handling all ran unbounded
# in the serving process, where nothing could stop them short of the platform
# kill.
#
# So every model request now runs in a forked child that the serving process
# kills at a deadline, transitive descendants (Stan workers, any fork the
# analysis makes) included, and a timeout comes back to the caller as a
# structured error payload instead of a dropped connection.
#
# The process-tree helpers here intentionally duplicate their twins in
# rtma_model.R rather than sharing one definition: rtma_model.R ships
# standalone inside reproducibility packages (see the UI's lib/reproducibility)
# and cannot source server-only files, and this file must not depend on an
# RTMA-specific one. Keep the two sets in sync.

# Default wall-clock budget in seconds for a synchronous request. Interactive
# callers (the UI, the public /v1 API) get this cap: past it the user is
# staring at a spinner, and on Aug 15 that spinner ran 10 minutes per attempt.
# Callers with a reason to wait longer (the async orchestrator) pass
# parameters$timeoutSeconds explicitly. Keep in sync with
# BACKGROUND_TIMEOUT_SECONDS in apps/orchestrator/src/index.ts.
REQUEST_TIMEOUT_DEFAULT_SEC <- 120

# Upper bound on any requested budget, kept under the Lambda function timeout
# (600 s, prod-runtime) so the structured timeout error always beats the
# platform kill. timeoutSeconds is caller-settable on the public legacy routes,
# so values above this are clamped rather than trusted.
REQUEST_TIMEOUT_MAX_SEC <- 570

# Slack added to the enforced deadline on top of the nominal budget. An inner
# guard that fires close to the budget (the RTMA fit child is killed at the
# budget minus its headroom) needs a moment to deliver its friendlier error
# through the normal return path; without slack it would race the kill below
# and lose whenever the fit error arrived late.
REQUEST_TIMEOUT_GRACE_SEC <- 1

# Condition class that marks an error as "the analysis hit a wall-clock
# budget". rtma_model.R raises it (by string, to stay standalone) when the fit
# child is killed at its deadline; run_request_bounded() maps it to the timeout
# outcome so the caller reports it as a timeout, not an internal error.
REQUEST_TIMEOUT_ERROR_CLASS <- "request_timeout_error"

#' Resolve a request's wall-clock budget in seconds
#'
#' NULL means the caller did not ask, which is the interactive default. A
#' non-numeric or non-positive value is a bad request: no deadline can be
#' computed from it, so it is rejected rather than silently replaced. Values
#' above REQUEST_TIMEOUT_MAX_SEC are clamped: the routes are publicly
#' reachable, so the budget is an offer the server bounds, not a promise it
#' keeps at any size.
#'
#' @param raw The caller's timeoutSeconds value, or NULL when absent
#' @return The budget in seconds as a single positive number
resolve_request_timeout_sec <- function(raw) {
  if (is.null(raw)) {
    return(REQUEST_TIMEOUT_DEFAULT_SEC)
  }
  value <- suppressWarnings(as.numeric(raw))
  # is.finite() rejects NA, NaN and Inf in one test.
  if (length(value) != 1 || !is.finite(value) || value <= 0) {
    cli::cli_abort("The timeoutSeconds parameter must be a positive number.")
  }
  if (value > REQUEST_TIMEOUT_MAX_SEC) {
    cli::cli_alert_warning(
      "timeoutSeconds {value} exceeds the maximum; clamping to {REQUEST_TIMEOUT_MAX_SEC}."
    )
    value <- REQUEST_TIMEOUT_MAX_SEC
  }
  value
}

#' Resolve the request budget from a legacy route's parameters JSON string
#'
#' The legacy routes receive `parameters` as a JSON string. A body that does
#' not parse is not this guard's problem: the model function reports it in its
#' own error envelope, so the default budget is used rather than failing here.
#'
#' @param parameters_json The raw parameters JSON string
#' @return The budget in seconds as a single positive number
request_timeout_sec_from_json <- function(parameters_json) {
  params <- tryCatch(
    jsonlite::fromJSON(parameters_json),
    error = function(e) NULL
  )
  raw <- if (is.list(params)) params$timeoutSeconds else NULL
  resolve_request_timeout_sec(raw)
}

#' Snapshot the machine's pid -> parent pid table
#'
#' Twin of rtma_process_table() in rtma_model.R; see the note at the top of
#' this file for why the two are not shared. Read from /proc on Linux (the
#' Lambda image, where `ps` is not installed) and from ps everywhere else.
#'
#' @return list(pid = <integer>, ppid = <integer>), or NULL if neither source
#'   could be read
request_process_table <- function() {
  tryCatch(
    {
      if (dir.exists("/proc")) {
        pids <- as.integer(list.files("/proc", pattern = "^[0-9]+$"))
        ppids <- vapply(pids, function(pid) {
          # /proc/<pid>/stat is one line: pid (comm) state ppid ... The command
          # name can contain spaces and parentheses, so parse from the last
          # closing parenthesis, after which the fields are fixed-width.
          stat <- tryCatch(
            readLines(file.path("/proc", pid, "stat"), warn = FALSE),
            error = function(e) character(0)
          )
          if (length(stat) != 1) {
            return(NA_integer_)
          }
          fields <- strsplit(sub("^.*\\)\\s*", "", stat), " ", fixed = TRUE)[[1]]
          suppressWarnings(as.integer(fields[2]))
        }, integer(1))
      } else {
        lines <- suppressWarnings(
          system2("ps", c("-Ao", "pid=,ppid="), stdout = TRUE, stderr = FALSE)
        )
        fields <- strsplit(trimws(lines), "[[:space:]]+")
        fields <- fields[lengths(fields) == 2]
        pids <- suppressWarnings(as.integer(vapply(fields, `[[`, "", 1)))
        ppids <- suppressWarnings(as.integer(vapply(fields, `[[`, "", 2)))
      }
      complete <- !is.na(pids) & !is.na(ppids)
      list(pid = pids[complete], ppid = ppids[complete])
    },
    error = function(e) NULL
  )
}

#' Transitive descendants of a process within a table snapshot
#'
#' Twin of rtma_descendants() in rtma_model.R.
#'
#' @param pid Root process id
#' @param table Snapshot from request_process_table(), or NULL
#' @return Integer vector of descendant pids, possibly empty
request_process_descendants <- function(pid, table) {
  pid <- as.integer(pid)
  if (is.null(table) || length(table$pid) == 0) {
    return(integer(0))
  }
  found <- integer(0)
  frontier <- pid
  repeat {
    children <- setdiff(table$pid[table$ppid %in% frontier], c(found, pid))
    if (length(children) == 0) {
      return(found)
    }
    found <- c(found, children)
    frontier <- children
  }
}

#' Kill a request child together with every process it forked
#'
#' Twin of rtma_kill_fit_tree() in rtma_model.R, and the answer to the Aug 15
#' failure mode: killing the child alone is not enough, because a Stan worker
#' or bootstrap fork orphaned mid-grind keeps burning the container's CPU with
#' nothing left to stop it. The descendants go first, while the ppid links that
#' identify them still exist; the moment the child dies the kernel reparents
#' its orphans to init and they can no longer be found.
#'
#' The scan repeats so a process forked between one scan and its kill is still
#' caught. Processes already killed stay visible as zombies of the live child,
#' so the loop terminates on the set of pids already signalled rather than on
#' liveness.
#'
#' @param pid Process id of the request child
#' @return Integer vector of the descendant pids signalled, invisibly
request_kill_process_tree <- function(pid) {
  pid <- as.integer(pid)
  signalled <- integer(0)
  for (attempt in seq_len(3L)) {
    descendants <- setdiff(
      request_process_descendants(pid, request_process_table()),
      signalled
    )
    if (length(descendants) == 0) {
      break
    }
    for (descendant in descendants) {
      tools::pskill(descendant, tools::SIGKILL)
    }
    signalled <- c(signalled, descendants)
    Sys.sleep(0.05)
  }
  tools::pskill(pid, tools::SIGKILL)
  invisible(signalled)
}

#' Run one request's work under a wall-clock budget that is actually enforced
#'
#' The request work runs in a forked child this process can kill: poll for its
#' result, and at the deadline kill the child and everything it forked. Where R
#' cannot fork (Windows, dev-only) the work runs in-process under setTimeLimit,
#' which is best-effort because R only checks elapsed-time limits at R-level
#' interrupt points.
#'
#' Failures are returned rather than thrown so the caller owns every
#' user-facing payload, and so a timeout cannot be confused with an analysis
#' error that happens to arrive near the deadline.
#'
#' @param request_call Zero-argument function that does the request's work.
#'   Whatever it returns is handed back untouched.
#' @param timeout_sec Wall-clock budget in seconds; the enforced deadline adds
#'   REQUEST_TIMEOUT_GRACE_SEC on top (see that constant)
#' @return One of
#'   list(status = "ok", value = <request_call's value>, elapsed_sec = <secs>),
#'   list(status = "timeout", elapsed_sec, message = <string or NULL>),
#'   list(status = "error", elapsed_sec, message, condition), or
#'   list(status = "died", elapsed_sec) when the child vanished without either
run_request_bounded <- function(request_call, timeout_sec) {
  if (.Platform$OS.type != "unix") {
    return(run_request_bounded_in_process(request_call, timeout_sec))
  }

  started <- Sys.time()
  elapsed_sec <- function() {
    as.numeric(difftime(Sys.time(), started, units = "secs"))
  }

  job <- parallel::mcparallel(request_call())
  collected <- NULL
  # The child must not outlive this call on any exit path: the deadline, an
  # error raised below, or an interrupt delivered to the serving process.
  on.exit(
    if (is.null(collected)) {
      request_kill_process_tree(job$pid)
      # Reap the corpse rather than leave a zombie for the life of the
      # container. mccollect warns that the job returned no result, which is
      # exactly what a killed child looks like and carries no information.
      suppressWarnings(try(
        parallel::mccollect(job, wait = FALSE, timeout = 1),
        silent = TRUE
      ))
    },
    add = TRUE
  )

  deadline <- started + timeout_sec + REQUEST_TIMEOUT_GRACE_SEC
  repeat {
    remaining <- as.numeric(difftime(deadline, Sys.time(), units = "secs"))
    if (remaining <= 0) {
      break
    }
    # Sliced so the deadline is honoured to about a quarter second however
    # long the work runs. Each slice blocks in select(), so this is not a spin.
    collected <- parallel::mccollect(
      job,
      wait = FALSE,
      timeout = min(0.25, remaining)
    )
    if (!is.null(collected)) {
      break
    }
  }

  if (is.null(collected)) {
    return(list(status = "timeout", elapsed_sec = elapsed_sec(), message = NULL))
  }

  result <- collected[[1]]
  if (inherits(result, "try-error")) {
    # The child's own error, forwarded by mccollect. Report the message the
    # analysis wrote rather than mccollect's wrapper text, and recognise the
    # inner guards' timeout condition so it surfaces as a timeout.
    condition <- attr(result, "condition")
    if (inherits(condition, REQUEST_TIMEOUT_ERROR_CLASS)) {
      return(list(
        status = "timeout",
        elapsed_sec = elapsed_sec(),
        message = conditionMessage(condition)
      ))
    }
    return(list(
      status = "error",
      elapsed_sec = elapsed_sec(),
      message = if (is.null(condition)) {
        trimws(as.character(result))
      } else {
        conditionMessage(condition)
      },
      condition = condition
    ))
  }
  if (is.null(result)) {
    # Gone without a result and without an error: killed from outside this
    # request, in practice by the kernel's OOM killer.
    return(list(status = "died", elapsed_sec = elapsed_sec()))
  }
  list(status = "ok", value = result, elapsed_sec = elapsed_sec())
}

#' Run one request's work in this process under a best-effort time limit
#'
#' The fallback for platforms that cannot fork. setTimeLimit only fires at
#' R-level interrupt points, so the budget holds for everything except a
#' computation that never returns to R; it is kept because a loose bound beats
#' none, and because no deployed environment takes this path.
#'
#' @param request_call Zero-argument function that does the request's work
#' @param timeout_sec Wall-clock budget in seconds
#' @return The same outcome list as run_request_bounded()
run_request_bounded_in_process <- function(request_call, timeout_sec) {
  started <- Sys.time()
  elapsed_sec <- function() {
    as.numeric(difftime(Sys.time(), started, units = "secs"))
  }
  setTimeLimit(elapsed = timeout_sec + REQUEST_TIMEOUT_GRACE_SEC, transient = TRUE)
  on.exit(setTimeLimit(), add = TRUE)
  tryCatch(
    list(status = "ok", value = request_call(), elapsed_sec = elapsed_sec()),
    error = function(e) {
      setTimeLimit() # clear so error reporting is not itself interrupted
      err_message <- conditionMessage(e)
      if (inherits(e, REQUEST_TIMEOUT_ERROR_CLASS)) {
        return(list(
          status = "timeout",
          elapsed_sec = elapsed_sec(),
          message = err_message
        ))
      }
      # The interrupt can fire inside library code that re-throws it as an
      # opaque message, so elapsed time is the more reliable of the two tests.
      hit_deadline <- elapsed_sec() >= timeout_sec * 0.95 ||
        grepl("elapsed time limit", err_message, fixed = TRUE)
      if (hit_deadline) {
        list(status = "timeout", elapsed_sec = elapsed_sec(), message = NULL)
      } else {
        list(
          status = "error",
          elapsed_sec = elapsed_sec(),
          message = err_message,
          condition = e
        )
      }
    }
  )
}

#' Default user-facing message for a request killed at its budget
#'
#' @param timeout_sec The nominal budget in seconds
#' @return A single string
request_timeout_message <- function(timeout_sec) {
  paste0(
    "The request timed out after ", timeout_sec, " seconds. ",
    "The analysis exceeded its wall-clock budget before finishing. ",
    "Try winsorizing outliers, reducing the number of estimates, ",
    "or submitting the analysis as a background run."
  )
}

#' Translate a bounded-request outcome into a legacy route response
#'
#' The legacy routes report handler failures as HTTP 200 with an error flag,
#' and the UI keys off that shape, so the structured timeout payload extends it
#' rather than replacing it: `code` says what happened ("timeout" or
#' "worker_died"), and the budget and elapsed seconds carry what the server
#' knows (#526). Analysis errors are re-raised so the route's own error handler
#' keeps formatting them exactly as before.
#'
#' @param outcome Result of run_request_bounded()
#' @param timeout_sec The nominal budget the request ran under
#' @param endpoint Endpoint label used in log messages
#' @return The response body for plumber to serialize
legacy_bounded_response <- function(outcome, timeout_sec, endpoint) {
  elapsed <- round(outcome$elapsed_sec, 1)
  switch(outcome$status,
    ok = list(data = outcome$value),
    timeout = {
      cli::cli_alert_danger(
        "Timeout in {endpoint}: budget {timeout_sec}s, elapsed {elapsed}s; analysis process tree killed."
      )
      msg <- if (is.null(outcome$message)) {
        request_timeout_message(timeout_sec)
      } else {
        outcome$message
      }
      list(
        error = TRUE,
        code = "timeout",
        message = msg,
        timeoutSeconds = timeout_sec,
        elapsedSeconds = elapsed
      )
    },
    died = {
      cli::cli_alert_danger(
        "Analysis process died in {endpoint} after {elapsed}s without a result."
      )
      list(
        error = TRUE,
        code = "worker_died",
        message = paste(
          "The analysis stopped before returning a result.",
          "The process was killed from outside the request, which usually",
          "means the container ran out of memory.",
          "Try reducing the number of estimates."
        ),
        timeoutSeconds = timeout_sec,
        elapsedSeconds = elapsed
      )
    },
    {
      # Analysis error: hand it to the route's existing error path. "{msg}"
      # keeps cli from glue-interpolating braces inside the message itself.
      msg <- outcome$message
      cli::cli_abort("{msg}")
    }
  )
}
