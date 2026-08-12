# Deterministic RTMA via 2D quadrature.
#
# PROTOTYPE. Not sourced by anything in the production path; see
# docs/RTMA_PERFORMANCE.md for the benchmark and validation results behind it,
# and prototypes/rtma_quadrature_check.R for a side-by-side comparison runner
# against phacking::phacking_meta(). Requires no rstan; only stats + stats4.
#
# Evaluates the exact posterior that phacking's Stan model samples:
#
#   p(mu, tau | y) propto Jeffreys(mu, tau) *
#     prod_i Normal(y_i; mu, S_i) / Phi((tcrit*sei_i - mu)/S_i),
#   S_i = sqrt(tau^2 + sei_i^2),  over (mu, tau) in R x [0, inf),
#
# restricted to the nonaffirmative estimates, exactly as phacking_meta() does.
# The mode is the same stats4::mle Nelder-Mead MAP optimisation phacking runs;
# medians and equal-tailed CIs come from gridded marginals instead of HMC
# draws. No RNG anywhere.
#
# Grid geometry: this posterior has a compound shape on weak data: a sharp
# core at small tau plus a fat shelf running diagonally to large (mu, tau) at
# 1e-5..1e-8 of peak density, which still carries real probability. A single
# uniform grid cannot resolve both, so both axes use a sinh-transformed grid:
# uniform steps in t with mu = center + w*sinh(t), which is dense in the core
# and geometric in the tails. Trapezoid weights on the nonuniform grid do the
# rest. Outer bounds come from line-max scans (max over the other axis, so a
# diagonal ridge cannot hide from a point check), then an edge-mass check
# expands further if the boundary still carries more than 1e-9 of total mass.

# Vectorized log posterior for a fixed tau over a vector of mu values.
#
# Numerical stability, deep-truncation regime: for cz = (tcrit*sei - mu)/S
# below about -30 the textbook Fisher combos (cz*r + r^2 - 1 and friends,
# exactly as written in phacking's get_lprior and Stan model) cancel
# catastrophically: they are O(cz^-2) differences of O(cz^2) terms, so in
# doubles the prior becomes noise once |cz| exceeds ~1e4 and the far tail of
# the posterior turns to garbage. HMC never visits that region, which is why
# upstream has not hit this; a quadrature that integrates the tail must
# evaluate it correctly. For a = -cz >= 30 the combos and the truncated
# log-likelihood switch to asymptotic series in x = 1/a^2 built from the
# Mills-ratio excess (relative error ~1e-8 at the crossover, improving as
# a^-8; verified against direct evaluation at a = 8..30).
.rtma_logpost_mu_vec <- function(mu_vec, tau, yi, sei, tcrit) {
  k <- length(yi)
  m_len <- length(mu_vec)
  si2 <- tau^2 + sei^2
  si <- sqrt(si2)
  upper <- tcrit * sei # k-vector: truncation points
  mu_rep <- rep(mu_vec, each = k)
  cz <- (upper - mu_rep) / si # k x M, column-major
  dim(cz) <- c(k, m_len)

  deep <- cz < -30
  any_deep <- any(deep)

  lpnorm <- pnorm(cz, log.p = TRUE)
  ldnorm <- dnorm(cz, log = TRUE)
  r <- exp(ldnorm - lpnorm) # Mills ratio, stable as a value for cz << 0

  # Log-likelihood, direct form
  resid <- yi - mu_rep
  dim(resid) <- c(k, m_len)
  ll_mat <- -log(si) - 0.5 * log(2 * pi) - resid^2 / (2 * si2) - lpnorm

  # Fisher combos, direct form
  f1 <- cz * r + r^2 - 1
  f2 <- r * (cz^2 + cz * r + 1)
  f3 <- cz^3 * r + cz^2 * r^2 + cz * r - 2

  if (any_deep) {
    a <- -cz[deep]
    x <- 1 / a^2
    delta <- (1 / a) * (1 - 2 * x + 10 * x^2 - 74 * x^3 + 706 * x^4)
    eta <- -2 * x + 10 * x^2 - 74 * x^3 + 706 * x^4
    a2eta <- -2 + 10 * x - 74 * x^2 + 706 * x^3
    f1[deep] <- eta + delta^2
    f2[deep] <- -(a + delta) * eta
    f3[deep] <- a2eta + eta + eta^2 - 2

    # Stable truncated-normal log-likelihood: with u the truncation point,
    #   ll = -log si - D + log a - log(1 - x + 3x^2 - 15x^3 + 105x^4),
    #   D = (y - u)(y + u - 2 mu) / (2 si^2)
    # (the a^2/2-sized cancellation between the squared residual and
    # log Phi(cz) is resolved algebraically).
    u_mat <- matrix(upper, k, m_len)
    y_mat <- matrix(yi, k, m_len)
    si_mat <- matrix(si, k, m_len)
    s2_mat <- matrix(si2, k, m_len)
    d_deep <- (y_mat[deep] - u_mat[deep]) *
      (y_mat[deep] + u_mat[deep] - 2 * mu_rep[deep]) /
      (2 * s2_mat[deep])
    ll_mat[deep] <- -log(si_mat[deep]) - d_deep + log(a) -
      log(1 - x + 3 * x^2 - 15 * x^3 + 105 * x^4)
  }

  loglik <- colSums(ll_mat)

  fmm <- colSums(-f1 / matrix(si2, k, m_len))
  fms <- colSums(-(tau * f2) / matrix(si^3, k, m_len))
  fss <- colSums(-(tau^2 * f3) / matrix(si2^2, k, m_len))
  det_fish <- fmm * fss - fms^2
  lprior <- ifelse(det_fish > 0, 0.5 * log(det_fish), -Inf)

  lprior + loglik
}

# Negative log posterior for the optimizer (identical target to
# phacking:::nlpost_rtma, numerically stable via log.p).
.rtma_nlpost <- function(mu, tau, yi, sei, tcrit) {
  if (tau < 0) {
    return(Inf)
  }
  v <- .rtma_logpost_mu_vec(mu, tau, yi, sei, tcrit)
  if (!is.finite(v)) Inf else -v
}

#' Deterministic RTMA fit on the nonaffirmative subset.
#'
#' @param yi,sei full data vectors (all estimates, caller's sign convention)
#' @param favor_positive as in phacking_meta (flip applied internally)
#' @param alpha_select significance threshold
#' @param ci_level credible level
#' @param n_mu,n_tau grid resolution (transformed axes); NULL picks defaults
#' @param drop_logdens outer bounds extend until the line-max log density is
#'   this far below the peak
#' @return list mirroring the app's RTMA fields plus grid diagnostics
rtma_quad <- function(yi, sei, favor_positive = TRUE, alpha_select = 0.05,
                      ci_level = 0.95, n_mu = NULL, n_tau = NULL,
                      drop_logdens = 34.5) {
  t0 <- proc.time()[["elapsed"]]
  if (!favor_positive) yi <- -yi
  tcrit <- qnorm(1 - alpha_select / 2)
  affirm <- (yi / sei) > tcrit
  k <- length(yi)
  k_nonaffirm <- sum(!affirm)
  if (k_nonaffirm == 0) stop("Dataset must contain at least one nonaffirmative study to fit RTMA.")
  y <- yi[!affirm]
  s <- sei[!affirm]

  # Cost per node is O(k_nonaffirm); large k also means a sharper posterior,
  # so fewer nodes lose nothing there (self-error checked in validation).
  if (is.null(n_mu)) n_mu <- if (k_nonaffirm > 600) 240L else 400L
  if (is.null(n_tau)) n_tau <- if (k_nonaffirm > 600) 120L else 200L

  # --- 1. MAP (same optimum phacking's mode targets) ----------------------
  mu0 <- stats::weighted.mean(y, 1 / s^2)
  tau0 <- max(stats::sd(y), stats::median(s), 1e-3)
  opt <- stats::optim(
    c(mu0, log(tau0)),
    function(p) .rtma_nlpost(p[1], exp(p[2]), y, s, tcrit),
    method = "Nelder-Mead",
    control = list(maxit = 2000, reltol = 1e-10)
  )
  map_mu <- opt$par[1]
  map_tau <- exp(opt$par[2])
  lp_max <- -opt$value

  # phacking's reported mode: the same stats4::mle call it makes, started
  # from the MAP instead of the best HMC draw (same optimum, no RNG).
  mle_fit <- stats4::mle(
    minuslogl = function(mu, tau) .rtma_nlpost(mu, tau, y, s, tcrit),
    start = list(mu = map_mu, tau = max(map_tau, 1e-6)),
    method = "Nelder-Mead"
  )
  mode_mu <- mle_fit@coef[["mu"]]
  mode_tau <- mle_fit@coef[["tau"]]
  optim_converged <- mle_fit@details$convergence == 0

  # --- 2. Core scales and outer bounds ------------------------------------
  h_mu <- max(abs(map_mu) * 1e-3, 1e-4)
  d2mu <- (.rtma_nlpost(map_mu + h_mu, map_tau, y, s, tcrit) -
    2 * opt$value + .rtma_nlpost(map_mu - h_mu, map_tau, y, s, tcrit)) / h_mu^2
  w_mu <- if (is.finite(d2mu) && d2mu > 0) 1 / sqrt(d2mu) else stats::sd(y) / sqrt(k_nonaffirm) + 1e-3
  w_tau <- max(map_tau, stats::median(s) / 4) / 2

  # Line-max scans: a bound is far enough out when the maximum log density
  # over a scan line in the OTHER coordinate has dropped below peak - drop.
  tau_line <- function(tau_max_probe) {
    c(0, w_tau * sinh(seq(0, asinh(tau_max_probe / w_tau), length.out = 47)))
  }
  mu_line <- function(lo, hi) seq(lo, hi, length.out = 48)

  max_over_tau_line <- function(mu, tau_max_probe) {
    max(vapply(
      tau_line(tau_max_probe),
      function(tt) .rtma_logpost_mu_vec(mu, tt, y, s, tcrit),
      numeric(1)
    ))
  }

  tau_probe <- max(4 * w_tau, 2 * map_tau, stats::median(s))
  mu_lo <- map_mu - 6 * w_mu
  mu_hi <- map_mu + 6 * w_mu
  for (i in 1:80) {
    # max over a tau line evaluated AT mu_hi; expand tau_probe alongside so
    # the diagonal shelf stays covered
    if (max_over_tau_line(mu_hi, tau_probe) - lp_max < -drop_logdens) break
    mu_hi <- map_mu + (mu_hi - map_mu) * 1.35
    tau_probe <- tau_probe * 1.25
  }
  for (i in 1:80) {
    if (max_over_tau_line(mu_lo, tau_probe) - lp_max < -drop_logdens) break
    mu_lo <- map_mu - (map_mu - mu_lo) * 1.35
  }
  tau_hi <- tau_probe
  for (i in 1:80) {
    m <- max(.rtma_logpost_mu_vec(mu_line(mu_lo, mu_hi), tau_hi, y, s, tcrit) - lp_max)
    if (m < -drop_logdens) break
    tau_hi <- tau_hi * 1.35
  }

  # --- 3. sinh-spaced grids + joint density -------------------------------
  # mu: uniform t in [-asinh((map-lo)/w), asinh((hi-map)/w)], mu = map + w*sinh(t)
  # tau: uniform t in [0, asinh(hi/w)], tau = w*sinh(t); tau = 0 included.
  build_grid <- function(mu_lo, mu_hi, tau_hi) {
    t_lo <- -asinh((map_mu - mu_lo) / w_mu)
    t_hi <- asinh((mu_hi - map_mu) / w_mu)
    mu_grid <- map_mu + w_mu * sinh(seq(t_lo, t_hi, length.out = n_mu))
    tau_grid <- w_tau * sinh(seq(0, asinh(tau_hi / w_tau), length.out = n_tau))
    logpost <- matrix(NA_real_, n_tau, n_mu)
    for (j in seq_len(n_tau)) {
      logpost[j, ] <- .rtma_logpost_mu_vec(mu_grid, tau_grid[j], y, s, tcrit)
    }
    m <- max(logpost[is.finite(logpost)])
    dens <- exp(logpost - m)
    dens[!is.finite(dens)] <- 0

    # Trapezoid weights on the nonuniform grids
    tw <- function(g) {
      n <- length(g)
      c(g[2] - g[1], g[3:n] - g[1:(n - 2)], g[n] - g[n - 1]) / 2
    }
    w_mu_g <- tw(mu_grid)
    w_tau_g <- tw(tau_grid)
    wdens <- (w_tau_g %o% w_mu_g) * dens # mass per cell
    total <- sum(wdens)
    list(
      mu_grid = mu_grid, tau_grid = tau_grid, dens = dens,
      w_mu = w_mu_g, w_tau = w_tau_g, total = total,
      edge_mu_lo = sum(wdens[, 1]) / total,
      edge_mu_hi = sum(wdens[, n_mu]) / total,
      edge_tau_hi = sum(wdens[n_tau, ]) / total,
      edge_frac = (sum(wdens[, 1]) + sum(wdens[, n_mu]) + sum(wdens[n_tau, ])) / total
    )
  }

  g <- build_grid(mu_lo, mu_hi, tau_hi)
  expansions <- 0L
  while (g$edge_frac > 1e-9 && expansions < 6L) {
    if (g$edge_mu_lo > 1e-10) mu_lo <- map_mu - (map_mu - mu_lo) * 2
    if (g$edge_mu_hi > 1e-10) mu_hi <- map_mu + (mu_hi - map_mu) * 2
    if (g$edge_tau_hi > 1e-10) tau_hi <- tau_hi * 2
    g <- build_grid(mu_lo, mu_hi, tau_hi)
    expansions <- expansions + 1L
  }

  # --- 4. Marginals and quantiles ----------------------------------------
  marg_mu <- as.numeric(crossprod(g$w_tau, g$dens)) # density over mu grid
  marg_tau <- as.numeric(g$dens %*% g$w_mu)

  qtile <- function(grid, marg, w, probs) {
    mass <- marg * w
    z <- sum(mass)
    cdf <- cumsum(mass) / z
    vapply(probs, function(p) {
      i <- findInterval(p, cdf)
      if (i <= 0) {
        return(grid[1])
      }
      if (i >= length(grid)) {
        return(grid[length(grid)])
      }
      c0 <- cdf[i]
      c1 <- cdf[i + 1]
      grid[i] + (grid[i + 1] - grid[i]) * (p - c0) / max(c1 - c0, .Machine$double.eps)
    }, numeric(1))
  }

  alpha <- 1 - ci_level
  q_mu <- qtile(g$mu_grid, marg_mu, g$w_mu, c(alpha / 2, 0.5, 1 - alpha / 2))
  q_tau <- qtile(g$tau_grid, marg_tau, g$w_tau, c(alpha / 2, 0.5, 1 - alpha / 2))

  # Weak-identification diagnostic: posterior probability that mu exceeds the
  # largest truncation point, i.e. the mass of the "everything got truncated"
  # shelf. Near zero on well-identified data; tens of percent on data where
  # the credible interval is seed-unstable under HMC.
  u_max <- tcrit * max(s)
  mu_mass <- marg_mu * g$w_mu
  shelf_mass <- sum(mu_mass[g$mu_grid > u_max]) / sum(mu_mass)

  mu_mode <- mode_mu
  mu_median <- q_mu[2]
  mu_ci <- c(q_mu[1], q_mu[3])
  if (!favor_positive) {
    mu_mode <- -mu_mode
    mu_median <- -mu_median
    mu_ci <- c(-mu_ci[2], -mu_ci[1])
  }

  list(
    mu = mu_mode, muMedian = mu_median, muCI = mu_ci,
    tau = mode_tau, tauMedian = q_tau[2], tauCI = c(q_tau[1], q_tau[3]),
    k = k, kNonaffirm = k_nonaffirm,
    shelfMass = shelf_mass,
    optimConverged = optim_converged,
    grid = list(
      mu_range = c(mu_lo, mu_hi), tau_max = tau_hi, n_mu = n_mu, n_tau = n_tau,
      map = c(mu = map_mu, tau = map_tau),
      edge_frac = g$edge_frac, expansions = expansions,
      secs = proc.time()[["elapsed"]] - t0
    )
  )
}
