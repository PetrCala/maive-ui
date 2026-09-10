# RDT (Residual Discontinuity Test). Diagnostic only, no corrected effect.
#
# Reported standard errors are estimated rather than given, so they can be
# chosen (clustering level, HAC, controls). Regressing log(SE) on log(N) leaves
# a residual, pi, which is the part of reported precision that sample size does
# not explain. RDT asks whether the conditional mean of pi jumps at |t| = 1.96.
# Selection on t alone cannot move the mean residual at a given t; selection
# that also depends on effect size can, so a jump is evidence of precision
# adjusted or selected at the cutoff, not proof of manipulation.
#
# Sign convention: pi is a residual of log(SE), so LOWER means more precise
# than sample size predicts, and the p-hacking signature is a DOWNWARD jump at
# the cutoff (a negative coefficient on `d`).
#
# Inference is CONVENTIONAL (not bias-corrected): a local-linear fit with a
# triangular kernel and CR2 cluster-robust standard errors, not the
# bias-corrected interval of Calonico, Cattaneo and Titiunik (2014). This is a
# deliberate v1 choice to avoid pulling in rdrobust (#559). No user options: the
# cutoff, running variable, kernel, bandwidth rule and inference are all fixed.

RDT_PLOT_RES <- 120

RDT_CUTOFF <- log(1.96)
RDT_BANDWIDTH_MIN <- 0.25 # log points
RDT_BANDWIDTH_MAX <- 1.00 # |t| in [0.72, 5.33]; wider is no longer local
RDT_MIN_ROWS <- 30
RDT_MIN_SIDE <- 10 # usable estimates each side of the cutoff
RDT_MIN_WINDOW <- 5 # estimates each side inside the bandwidth
RDT_MIN_STUDIES_IN_WINDOW <- 10
# First-stage R-squared above which the residual has no variation left: the
# standard errors are then an almost exact function of N and RDT cannot say
# anything. One of the app's own mock datasets sits at exactly 1.000.
#
# This threshold only separates cases where log(SE) HAS variation that log(N)
# explains. It cannot see a constant SE column, which leaves log(SE) with no
# variation to explain in the first place: both sums of squares are then ~1e-31
# and R-squared = 1 - RSS/TSS is an arbitrary ratio of rounding error (0.4999 on
# the repro), so it never crosses this threshold. That case is refused outright
# below, before the first stage runs.
RDT_FIRST_STAGE_R2_WARN <- 0.99
# Relative spread below which a standard-error column counts as constant. Same
# value and meaning as SE_DEGENERATE_RELATIVE_TOLERANCE in maive_model.R and in
# the UI's datasetValidation.ts (#564); RDT sources neither, so it carries its
# own copy. Keep the three in sync.
RDT_SE_DEGENERATE_RELATIVE_TOLERANCE <- 1e-05
# Share of estimates above which the standard errors are treated as
# back-computed rather than reported. A standard error obtained as
# |effect / t| from a printed 2dp t-statistic leaves |t| on the 2dp grid AND
# carries full double precision, unlike a reported SE (2-4 digits); either
# fingerprint alone gives false positives, the pair separates cleanly. Corpus
# median 0.19; the five reconstructed literatures run 0.63-0.83.
RDT_RECONSTRUCTED_SE_WARN <- 0.60
# Distinct values of the running variable log|t| that the Imbens-Kalyanaraman
# pilot cubic needs. With fewer than five its u^3 coefficient is NA and the
# bandwidth rule throws "missing value where TRUE/FALSE needed"; at exactly
# five, 2 of 3 seeds in #573 still died further down the pipeline, so six is
# the floor. The per-window guard in rdt_local_linear covers what this one
# cannot see: values that exist in the data but not inside the bandwidth.
RDT_MIN_DISTINCT_T <- 6
# Gap in log|t| below which two estimates count as the same value for that
# floor: 0.1% in |t|. A t-statistic reproduced from numbers rounded to four
# or more significant digits comes back with noise at 1e-4 or less and still
# counts once; t-statistics printed to two decimals sit at least 0.2% apart on
# the |t| range RDT uses, so they stay distinct.
RDT_DISTINCT_T_TOLERANCE <- 1e-03
# Distinct log|t| values each side of the cutoff needs inside the estimation
# window for the local-linear fit. Two identify a line per side, but the CR2
# Satterthwaite step still hit a singular chol() on 2 of 120 sweep draws at
# two; none at three (#573).
RDT_MIN_DISTINCT_T_IN_WINDOW <- 3
# Clusters the CR2 cluster-robust variance needs. clubSandwich refuses a single
# cluster with its own message, so the count is checked before the fit (#573).
RDT_MIN_CLUSTERS <- 2
# Power and size of the test the smallest detectable jump is defined for.
RDT_DETECTABLE_JUMP_POWER <- 0.80
RDT_DETECTABLE_JUMP_ALPHA <- 0.05

#' Multiple of the standard error that a two-sided t test detects with 80% power
#'
#' The interval beside the smallest-detectable-jump line is a t interval on
#' Satterthwaite degrees of freedom, so the multiplier is the noncentrality m
#' at which P(|T_{df, ncp = m}| > qt(0.975, df)) = 0.80, found by root search
#' over the noncentral t distribution. The normal-theory constant
#' qnorm(0.975) + qnorm(0.80) = 2.8 understates it at every finite df, by 46%
#' at df 2.2 and still 5% at df 20, which is where RDT is least informative
#' (#573). qt(0.975, df) + qt(0.80, df) is closer but still delivers only
#' 77% power at df 2.2; it is used only if the root search fails.
#'
#' @param df Satterthwaite degrees of freedom of the jump
#' @return The multiplier; 5.208 at df 2.2, 3.761 at df 4, 3.201 at df 8,
#'   3.053 from about df 12 on, tending to 2.8 as df grows
rdt_detectable_jump_multiple <- function(df) {
  if (!is.finite(df) || df <= 0) {
    return(NA_real_)
  }
  crit <- stats::qt(1 - RDT_DETECTABLE_JUMP_ALPHA / 2, df)
  approx <- crit + stats::qt(RDT_DETECTABLE_JUMP_POWER, df)
  power_gap <- function(m) {
    stats::pt(crit, df, ncp = m, lower.tail = FALSE) +
      stats::pt(-crit, df, ncp = m) - RDT_DETECTABLE_JUMP_POWER
  }
  root <- tryCatch(
    stats::uniroot(power_gap, c(0, 4 * approx), tol = 1e-10)$root,
    error = function(e) NA_real_
  )
  if (is.finite(root)) root else approx
}

#' Count the distinct values of a numeric vector up to a gap tolerance
#'
#' Sorts the values and counts the gaps wider than `tol`, so a value that
#' repeats with rounding noise counts once and the count does not depend on
#' where the noise falls relative to a rounding boundary.
#'
#' @param x Numeric vector
#' @param tol Gap above which two neighbours are different values
#' @return Number of distinct values
rdt_distinct_count <- function(x, tol) {
  values <- sort(x[is.finite(x)])
  if (length(values) == 0) {
    return(0L)
  }
  1L + sum(diff(values) > tol)
}

#' Check whether a standard-error column carries no usable variation
#'
#' Same rule as `se_column_is_degenerate` in maive_model.R, duplicated because
#' the RDT route sources only this file and pulling in the MAIVE model would
#' load clubSandwich and metafor for one predicate. Named apart from the MAIVE
#' copy so neither shadows the other when both files are sourced into the same
#' environment.
#'
#' @param se Numeric vector of standard errors
#' @return TRUE when the column is constant up to the relative tolerance
rdt_se_column_is_degenerate <- function(se) {
  values <- se[is.finite(se)]
  if (length(values) < 2) {
    return(FALSE)
  }

  se_scale <- max(abs(values))
  if (se_scale == 0) {
    return(FALSE)
  }

  diff(range(values)) <= RDT_SE_DEGENERATE_RELATIVE_TOLERANCE * se_scale
}

# Imbens & Kalyanaraman (2012, REStud) sec. 4.2, regularized, triangular kernel.
#
# @param y Outcome (the first-stage residual pi)
# @param x Running variable (log |t|)
# @param c Cutoff on the running variable
# @return Bandwidth in log points, clamped to [RDT_BANDWIDTH_MIN, RDT_BANDWIDTH_MAX]
rdt_ik_bandwidth <- function(y, x, c) {
  n <- length(x)
  h1 <- 1.84 * stats::sd(x) * n^(-1 / 5)
  left <- x < c & x >= c - h1
  right <- x >= c & x <= c + h1
  f_c <- (sum(left) + sum(right)) / (2 * n * h1)
  s2_l <- if (sum(left) >= 2) stats::var(y[left]) else stats::var(y)
  s2_r <- if (sum(right) >= 2) stats::var(y[right]) else stats::var(y)
  u <- x - c
  d <- as.numeric(u >= 0) # nolint: object_usage_linter. Used in the formula below.
  cubic <- stats::lm(y ~ d + u + I(u^2) + I(u^3))
  m3 <- 6 * unname(stats::coef(cubic)[5])
  n_l <- sum(u < 0)
  n_r <- sum(u >= 0)
  h2_l <- 3.56 * (s2_l / (f_c * max(m3^2, 1e-8)))^(1 / 7) * n_l^(-1 / 7)
  h2_r <- 3.56 * (s2_r / (f_c * max(m3^2, 1e-8)))^(1 / 7) * n_r^(-1 / 7)
  nearest <- function(win, side, k) { # widen a starved pilot window to k nearest points
    if (sum(win) >= k || sum(side) < k) {
      return(win | (sum(side) < k & side))
    }
    ord <- order(abs(u))
    win[ord[side[ord]][seq_len(k)]] <- TRUE
    win
  }
  wl <- nearest(u < 0 & u >= -h2_l, u < 0, 4)
  wr <- nearest(u >= 0 & u <= h2_r, u >= 0, 4)
  m2_l <- 2 * unname(stats::coef(stats::lm(y[wl] ~ u[wl] + I(u[wl]^2)))[3])
  m2_r <- 2 * unname(stats::coef(stats::lm(y[wr] ~ u[wr] + I(u[wr]^2)))[3])
  r_l <- 2160 * s2_l / (sum(wl) * h2_l^4)
  r_r <- 2160 * s2_r / (sum(wr) * h2_r^4)
  ratio <- (s2_l + s2_r) / (f_c * ((m2_r - m2_l)^2 + r_l + r_r))
  h <- 3.4375 * ratio^(1 / 5) * n^(-1 / 5)
  if (!is.finite(h) || h <= 0) h <- h1
  min(max(h, RDT_BANDWIDTH_MIN), RDT_BANDWIDTH_MAX)
}

# Local-linear fit of the jump at `c` inside bandwidth `h`, triangular kernel,
# CR2 cluster-robust by `cl` with Satterthwaite degrees of freedom.
#
# @param y Outcome (the first-stage residual pi)
# @param x Running variable (log |t|)
# @param cl Cluster id per estimate (study id, or the row when there is none)
# @param c Cutoff on the running variable
# @param h Bandwidth in log points
# @return List with the jump, its SE, 95% interval, p-value, the effective
#   bandwidth, counts each side, the number of clusters and the fit
#   coefficients (for the plot)
rdt_local_linear <- function(y, x, cl, c, h) {
  u <- x - c
  keep <- abs(u) <= h
  # if the auto bandwidth starves one side, widen it to its nearest few points
  for (side in list(u < 0, u >= 0)) {
    if (sum(keep & side) < RDT_MIN_WINDOW && sum(side) >= RDT_MIN_WINDOW) {
      ord <- order(abs(u))
      keep[ord[side[ord]][seq_len(RDT_MIN_WINDOW)]] <- TRUE
    }
  }
  if (sum(keep & u < 0) < 2 || sum(keep & u >= 0) < 2) {
    cli::cli_abort("Too few estimates on one side of the cutoff inside the estimation window.")
  }
  h_eff <- max(abs(u[keep]))
  # One line per side needs distinct running-variable values on each side
  # inside the window. With too few the design is rank deficient, and the
  # failure surfaces from clubSandwich's Satterthwaite step as "the leading
  # minor of order 3 is not positive" (#573).
  distinct_below <- rdt_distinct_count(u[keep & u < 0], RDT_DISTINCT_T_TOLERANCE)
  distinct_above <- rdt_distinct_count(u[keep & u >= 0], RDT_DISTINCT_T_TOLERANCE)
  if (distinct_below < RDT_MIN_DISTINCT_T_IN_WINDOW || distinct_above < RDT_MIN_DISTINCT_T_IN_WINDOW) {
    cli::cli_abort(paste0(
      "Estimates inside the estimation window take only ", distinct_below,
      " distinct |t| value(s) below the cutoff and ", distinct_above, " above; the local ",
      "fit needs at least ", RDT_MIN_DISTINCT_T_IN_WINDOW, " on each side."
    ))
  }
  dat <- data.frame(
    y = y[keep], u = u[keep],
    d = as.numeric(u[keep] >= 0), cl = cl[keep]
  )
  if (length(unique(dat$cl)) < RDT_MIN_CLUSTERS) {
    cli::cli_abort(paste0(
      "Every estimate inside the estimation window comes from a single study, ",
      "so no cluster-robust standard error can be computed."
    ))
  }
  dat$w <- pmax(1 - abs(dat$u) / h_eff, 1e-8) # triangular kernel
  fit <- stats::lm(y ~ d * u, data = dat, weights = w) # nolint: object_usage_linter. w is a column of dat.

  # inverse_var = FALSE: kernel weights are not precision weights
  vc <- clubSandwich::vcovCR(fit,
    cluster = dat$cl, type = "CR2",
    inverse_var = FALSE
  )
  ct <- clubSandwich::coef_test(fit, vcov = vc, test = "Satterthwaite")
  row <- ct[ct$Coef == "d", ]
  crit <- stats::qt(0.975, row$df_Satt)

  list(
    jump = row$beta, jumpSE = row$SE,
    jumpCI = c(row$beta - crit * row$SE, row$beta + crit * row$SE),
    pValue = row$p_Satt, df = row$df_Satt, bandwidth = h_eff,
    nLeft = sum(dat$d == 0), nRight = sum(dat$d == 1),
    studies = length(unique(dat$cl)),
    coefficients = stats::coef(fit)
  )
}

# The subset of an rdt_local_linear() result that goes into the response.
rdt_fit_summary <- function(fit, cutoff_t) {
  list(
    jump = fit$jump,
    jumpSE = fit$jumpSE,
    jumpCI = fit$jumpCI,
    pValue = fit$pValue,
    bandwidth = fit$bandwidth,
    cutoff = cutoff_t,
    nLeft = fit$nLeft,
    nRight = fit$nRight,
    studies = fit$studies
  )
}

# A check fit that could not be computed is reported as its reason rather than
# taking the whole diagnostic down: the headline does not depend on it.
rdt_fit_or_reason <- function(y, x, cl, c, h) {
  tryCatch(
    rdt_fit_summary(rdt_local_linear(y, x, cl, c, h), exp(c)),
    error = function(e) list(unavailable = conditionMessage(e))
  )
}

#' Render the RDT figure and return it as a base64-encoded PNG data URI
#'
#' A binned scatter of pi against |t| on a log axis, with the cutoff dashed,
#' the estimation window shaded and the two fitted local-linear segments drawn
#' inside it. Dot size is proportional to bin count. Base graphics through
#' ragg, exactly like funnel_plot.R.
#'
#' @param pi First-stage residuals
#' @param r Running variable, log |t|
#' @param fit The headline rdt_local_linear() result
#' @param cutoff Cutoff on the running variable
#' @param res Resolution in pixels per inch
#' @return A list of the data URI, width, and height of the plot
render_rdt_plot <- function(pi, r, fit, cutoff = RDT_CUTOFF, res = RDT_PLOT_RES) {
  width_px <- res * 7
  height_px <- res * 5.5

  tmp <- tempfile(fileext = ".png")
  ragg::agg_png(tmp, width = width_px, height = height_px, res = res)
  on.exit(unlink(tmp), add = TRUE)

  n_bins <- max(10L, min(30L, floor(length(r) / 5)))
  breaks <- seq(min(r), max(r), length.out = n_bins + 1)
  breaks[1] <- breaks[1] - 1e-9
  breaks[length(breaks)] <- breaks[length(breaks)] + 1e-9
  bin <- cut(r, breaks, include.lowest = TRUE)
  bin_x <- as.numeric(tapply(r, bin, mean))
  bin_y <- as.numeric(tapply(pi, bin, mean))
  bin_n <- as.numeric(tapply(pi, bin, length))
  filled <- is.finite(bin_x) & is.finite(bin_y) & bin_n > 0
  bin_x <- bin_x[filled]
  bin_y <- bin_y[filled]
  bin_n <- bin_n[filled]
  cex <- 0.7 + 2.3 * sqrt(bin_n / max(bin_n))

  t_abs <- exp(r)
  ticks <- c(0.25, 0.5, 1, 1.96, 3, 5, 10)
  x_lim <- range(c(t_abs, 0.5, 5))
  y_pad <- 0.1 * diff(range(bin_y))
  y_lim <- range(bin_y) + c(-1, 1) * max(y_pad, 0.05)

  graphics::plot(
    x = t_abs, y = pi,
    type = "n", log = "x", xaxt = "n",
    xlim = x_lim, ylim = y_lim,
    # No main title: the page supplies the heading, and a bold-face title is
    # one more font lookup than the preloaded regular face, which is not fork
    # safe on every platform (ragg in the bounded child, #526).
    xlab = "|t| (log scale)",
    ylab = "Residual precision (lower = more precise than N predicts)"
  )
  # Taller than the plot region on purpose; the device clips it to the axes.
  graphics::rect(
    exp(cutoff - fit$bandwidth), y_lim[1] - 10, exp(cutoff + fit$bandwidth), y_lim[2] + 10,
    col = grDevices::adjustcolor("steelblue", alpha.f = 0.12), border = NA
  )
  graphics::axis(1, at = ticks, labels = format(ticks, drop0trailing = TRUE))
  graphics::abline(v = 1.96, lty = 2, col = "grey30")
  graphics::points(
    exp(bin_x), bin_y,
    pch = 21, cex = cex,
    bg = grDevices::adjustcolor("grey40", alpha.f = 0.6), col = "grey20"
  )

  b <- fit$coefficients
  u_left <- seq(-fit$bandwidth, 0, length.out = 50)
  u_right <- seq(0, fit$bandwidth, length.out = 50)
  graphics::lines(
    exp(cutoff + u_left), b[["(Intercept)"]] + b[["u"]] * u_left,
    lwd = 2.5, col = "firebrick"
  )
  graphics::lines(
    exp(cutoff + u_right),
    (b[["(Intercept)"]] + b[["d"]]) + (b[["u"]] + b[["d:u"]]) * u_right,
    lwd = 2.5, col = "firebrick"
  )
  grDevices::dev.off()

  raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  list(
    data_uri = paste0("data:image/png;base64,", base64enc::base64encode(raw_png)),
    width_px = width_px,
    height_px = height_px
  )
}

#' Share of estimates whose standard error looks back-computed from a t-statistic
#'
#' A standard error obtained as |effect / t| from a printed two-decimal
#' t-statistic leaves two fingerprints together: the implied |t| sits on the
#' 2dp grid, and the standard error carries full double precision rather than
#' the two to four significant digits an author would print. The 1e-6
#' tolerance is deliberate: one genuine reconstruction stores its standard
#' errors to eight significant figures and is missed at 1e-8, while a
#' continuous |t| lands on the 2dp grid by chance with probability about 2e-4.
#'
#' @param effect Filtered effect estimates
#' @param se Filtered standard errors
#' @return Share of rows carrying both fingerprints
rdt_reconstructed_se_share <- function(effect, se) {
  t_abs <- abs(effect / se)
  se_digits <- nchar(sub("0+$", "", sub(
    "^0+", "",
    gsub("[^0-9]", "", sub("e.*$", "", sprintf("%.15g", se)))
  )))
  mean(abs(t_abs - round(t_abs, 2)) < 1e-6 & se_digits >= 7)
}

#' Run the Residual Discontinuity Test
#'
#' Columns are read positionally like the other legacy routes: effect,
#' standard error, sample size and, optionally, study id. The sample size is
#' mandatory. `parameters` is accepted for interface parity with the other
#' models and ignored: RDT has no user options.
#'
#' @param data JSON string of the data rows
#' @param parameters JSON string of the parameters (ignored)
#' @param include_plot Whether to render the figure
#' @return The RDT results list; `model = "RDT"` is its first field so callers
#'   can tell the payload apart from a MAIVE or RTMA result by shape
run_rdt_model <- function(data, parameters = "{}", include_plot = TRUE) {
  df <- jsonlite::fromJSON(data)
  if (!is.data.frame(df)) {
    df <- as.data.frame(df)
  }

  cli::cli_h2("RDT input data frame structure:")
  cli::cli_code(capture.output(str(df)))

  n_cols <- ncol(df)
  if (n_cols < 3) {
    cli::cli_abort(paste(
      "RDT needs effect, standard error and sample size columns; found", n_cols,
      "column(s). The sample size column is required."
    ))
  }

  effect <- suppressWarnings(as.numeric(df[[1]]))
  se <- suppressWarnings(as.numeric(df[[2]]))
  n_obs <- suppressWarnings(as.numeric(df[[3]]))
  has_study_column <- n_cols >= 4
  study <- if (has_study_column) as.character(df[[4]]) else as.character(seq_len(nrow(df)))

  # effect == 0 gives log|t| = -Inf, so it goes with the non-finite rows.
  usable <- is.finite(effect) & is.finite(se) & is.finite(n_obs) &
    se > 0 & n_obs > 0 & effect != 0 & !is.na(study) & nzchar(study)
  dropped_rows <- sum(!usable)
  effect <- effect[usable]
  se <- se[usable]
  n_obs <- n_obs[usable]
  study <- study[usable]
  k <- length(effect)

  cli::cli_alert_info(sprintf("RDT: %d usable estimates (%d rows dropped)", k, dropped_rows))

  if (k < RDT_MIN_ROWS) {
    cli::cli_abort(paste0(
      "RDT needs at least ", RDT_MIN_ROWS, " usable estimates; found ", k,
      " after dropping ", dropped_rows, " row(s) with a missing value, a non-positive",
      " standard error or sample size, or a zero effect."
    ))
  }

  r <- log(abs(effect / se))
  n_below <- sum(r < RDT_CUTOFF)
  n_above <- sum(r >= RDT_CUTOFF)
  if (n_below < RDT_MIN_SIDE || n_above < RDT_MIN_SIDE) {
    cli::cli_abort(paste0(
      "RDT needs at least ", RDT_MIN_SIDE, " usable estimates on each side of |t| = 1.96; found ",
      n_below, " below and ", n_above, " above."
    ))
  }

  # The Imbens-Kalyanaraman rule fits a pilot cubic in log|t|; a running
  # variable that takes only a handful of values (standard errors copied from
  # a few t-statistics, say) cannot support it, and R's own error from inside
  # the rule ("missing value where TRUE/FALSE needed") says nothing a user can
  # act on (#573).
  n_distinct_t <- rdt_distinct_count(r, RDT_DISTINCT_T_TOLERANCE)
  if (n_distinct_t < RDT_MIN_DISTINCT_T) {
    cli::cli_abort(paste0(
      "RDT needs at least ", RDT_MIN_DISTINCT_T, " distinct values of |t| = |effect / se| ",
      "to choose its bandwidth; found ", n_distinct_t, " among ", k, " usable estimates. ",
      "The local fit runs on |t|, so standard errors that put every estimate on a few ",
      "t-statistics leave it nothing to fit."
    ))
  }

  # CR2 standard errors cluster by study. One study is one cluster, and
  # clubSandwich refuses that with its own wording after the fit; say so here,
  # before it, in terms of the upload (#573).
  n_clusters <- length(unique(study))
  if (n_clusters < RDT_MIN_CLUSTERS) {
    # The study id is user text: pass the message as a glue value, not as the
    # template, so braces in it are printed instead of evaluated by cli.
    msg <- paste0(
      "RDT needs estimates from at least ", RDT_MIN_CLUSTERS, " studies to compute ",
      "cluster-robust standard errors; all ", k, " usable estimates come from a single study (",
      study[1], "). Supply a study column that separates the estimates into studies, or omit ",
      "it to cluster by estimate."
    )
    cli::cli_abort("{msg}")
  }

  # A constant SE column leaves log(SE) with no variation, so the residual the
  # whole test is built on is identically zero and what survives is rounding
  # error from the QR fit at ~1e-15. Every jump, interval and p-value below
  # would then be the significance of floating-point noise rather than a
  # measurement, and on the repro the half-bandwidth window reported p = 0.002.
  # Refused here rather than warned about, because there is no signal left to
  # qualify. Mirrors the MAIVE-family guard in maive_model.R (#564).
  if (rdt_se_column_is_degenerate(se)) {
    cli::cli_abort(paste0(
      "The se column has no usable variation: its ", length(se),
      " values are all ", format(signif(se[1], 6), scientific = FALSE),
      ". RDT reads reported precision off the part of log(SE) that sample size ",
      "does not explain, so a constant se column leaves that residual identically ",
      "zero and there is nothing left for a jump at the cutoff to be measured in. ",
      "Supply the standard errors as reported, which differ across estimates."
    ))
  }

  # First stage: the residual is the part of reported precision that sample
  # size does not explain. Past the guard above, log(SE) has real variation, so
  # R-squared below is a genuine share rather than a ratio of rounding error.
  first_stage <- stats::lm(log(se) ~ log(n_obs))
  pi <- unname(stats::residuals(first_stage))
  first_stage_slope <- unname(stats::coef(first_stage)[2])
  first_stage_r2 <- summary(first_stage)$r.squared

  h <- rdt_ik_bandwidth(pi, r, RDT_CUTOFF)
  headline <- rdt_local_linear(pi, r, study, RDT_CUTOFF, h)

  # Bandwidth sensitivity: the same fit at half and twice the headline window.
  sensitivity <- list(
    half = rdt_fit_or_reason(pi, r, study, RDT_CUTOFF, h / 2),
    double = rdt_fit_or_reason(pi, r, study, RDT_CUTOFF, 2 * h)
  )

  # Placebo thresholds: the same estimator at the median |t| on each side of
  # the cutoff, each fitted on its own side only, so the real cutoff never
  # enters the placebo window.
  below <- r < RDT_CUTOFF
  above <- r >= RDT_CUTOFF
  placebo_below_c <- stats::median(r[below])
  placebo_above_c <- stats::median(r[above])
  placebo <- list(
    below = rdt_fit_or_reason(pi[below], r[below], study[below], placebo_below_c, h),
    above = rdt_fit_or_reason(pi[above], r[above], study[above], placebo_above_c, h)
  )

  warnings <- character(0)
  if (!has_study_column) {
    warnings <- c(warnings, paste(
      "The data has no study column, so standard errors are clustered by estimate",
      "and are too small; the interval and p-value overstate precision."
    ))
  }
  if (headline$studies < RDT_MIN_STUDIES_IN_WINDOW) {
    warnings <- c(warnings, sprintf(
      "Only %d %s in the estimation window; the cluster-robust interval rests on very few clusters.",
      headline$studies, if (has_study_column) "studies" else "estimates"
    ))
  }
  if (headline$nLeft < RDT_MIN_SIDE || headline$nRight < RDT_MIN_SIDE) {
    warnings <- c(warnings, sprintf(
      "Fewer than %d estimates on one side of the cutoff inside the estimation window (%d below, %d above).",
      RDT_MIN_SIDE, headline$nLeft, headline$nRight
    ))
  }
  if (first_stage_r2 > RDT_FIRST_STAGE_R2_WARN) {
    warnings <- c(warnings, sprintf(
      paste(
        "First-stage R-squared is %.3f: the standard errors are an almost exact function of",
        "sample size, the residual has no variation, and RDT cannot say anything about this data."
      ),
      first_stage_r2
    ))
  }
  reconstructed_share <- rdt_reconstructed_se_share(effect, se)
  if (reconstructed_share > RDT_RECONSTRUCTED_SE_WARN) {
    warnings <- c(warnings, sprintf(
      paste(
        "%.0f%% of the implied t-statistics are exact to two decimal places and the standard",
        "errors carry full precision, which usually means they were back-computed from rounded",
        "t-statistics rather than reported. RDT then has no independent measure of reported",
        "precision, so read this result with caution."
      ),
      100 * reconstructed_share
    ))
  }

  cli::cli_h2("RDT summary:")
  cli::cli_bullets(c(
    "jump: {round(headline$jump, 4)} (SE {round(headline$jumpSE, 4)}, p = {signif(headline$pValue, 3)})",
    "bandwidth: {round(headline$bandwidth, 3)} log points",
    "window: {headline$nLeft} below, {headline$nRight} above, {headline$studies} clusters",
    "first stage: slope {round(first_stage_slope, 3)}, R2 {round(first_stage_r2, 4)}",
    "rows: {k} used, {dropped_rows} dropped"
  ))
  if (length(warnings) > 0) {
    cli::cli_h2("RDT warnings:")
    for (msg in warnings) {
      cli::cli_alert_warning("{msg}")
    }
  }

  results <- list(
    # First, and by name, so callers can tell this payload apart from a MAIVE
    # or RTMA result without guessing from its other fields (#559).
    model = "RDT",
    jump = headline$jump,
    jumpSE = headline$jumpSE,
    jumpCI = headline$jumpCI,
    pValue = headline$pValue,
    df = headline$df,
    cutoff = 1.96,
    bandwidth = headline$bandwidth,
    windowT = c(exp(RDT_CUTOFF - headline$bandwidth), exp(RDT_CUTOFF + headline$bandwidth)),
    nLeft = headline$nLeft,
    nRight = headline$nRight,
    studies = headline$studies,
    hasStudyColumn = has_study_column,
    k = k,
    droppedRows = dropped_rows,
    # Exact noncentral-t multiple on the headline df, so the line beside the t
    # interval means what it says at every cluster count (#573).
    minDetectableJump = rdt_detectable_jump_multiple(headline$df) * headline$jumpSE,
    firstStage = list(
      slope = first_stage_slope,
      rSquared = first_stage_r2
    ),
    sensitivity = sensitivity,
    placebo = placebo,
    # I() so the unboxed-JSON serializer keeps this an array even when a single
    # warning was raised.
    warnings = I(warnings)
  )

  if (include_plot) {
    plot_data <- render_rdt_plot(pi, r, headline)
    results$plot <- plot_data$data_uri
    results$plotWidth <- plot_data$width_px
    results$plotHeight <- plot_data$height_px
  }

  results
}
