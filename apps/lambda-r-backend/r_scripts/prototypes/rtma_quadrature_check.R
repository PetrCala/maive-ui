#!/usr/bin/env Rscript
# Side-by-side check: phacking::phacking_meta() vs the quadrature prototype.
#
# Usage:
#   Rscript rtma_quadrature_check.R <data.csv> [seed] [favor_positive]
#
# The CSV needs effect sizes in the first column and standard errors in the
# second (same convention as run_rtma_model). seed defaults to 2025, the
# production default; favor_positive defaults to TRUE.
#
# Prints both engines' mu and tau summaries and their differences. Remember
# that the HMC numbers carry Monte Carlo noise: rerun with a few different
# seeds before reading anything into a disagreement (on weakly identified
# data the HMC interval can move by more than its own width between seeds;
# docs/RTMA_PERFORMANCE.md section 4 explains why).

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  stop("Usage: Rscript rtma_quadrature_check.R <data.csv> [seed] [favor_positive]")
}
csv_path <- args[1]
seed <- if (length(args) >= 2) as.integer(args[2]) else 2025L
favor_positive <- if (length(args) >= 3) as.logical(args[3]) else TRUE

source(file.path(dirname(sub("--file=", "", grep("--file=", commandArgs(), value = TRUE))), "rtma_quadrature.R"))

df <- utils::read.csv(csv_path)
yi <- as.numeric(df[[1]])
sei <- as.numeric(df[[2]])
valid <- !is.na(yi) & !is.na(sei) & sei > 0
yi <- yi[valid]
sei <- sei[valid]

cat(sprintf(
  "n = %d, favor_positive = %s, seed = %d\n\n",
  length(yi), favor_positive, seed
))

t0 <- proc.time()[["elapsed"]]
q <- rtma_quad(yi, sei, favor_positive = favor_positive)
quad_secs <- proc.time()[["elapsed"]] - t0

suppressMessages(library(phacking))
t0 <- proc.time()[["elapsed"]]
set.seed(seed)
m <- phacking::phacking_meta(
  yi = yi, vi = sei^2, favor_positive = favor_positive, parallelize = FALSE
)
hmc_secs <- proc.time()[["elapsed"]] - t0

stats <- m$stats
mu_row <- stats[stats$param == "mu", ]
tau_row <- stats[stats$param == "tau", ]
h <- list(
  mu = mu_row$mode, muMedian = mu_row$median,
  muCI = c(mu_row$ci_lower, mu_row$ci_upper),
  tau = tau_row$mode, tauMedian = tau_row$median,
  tauCI = c(tau_row$ci_lower, tau_row$ci_upper)
)
if (!favor_positive) {
  h$mu <- -h$mu
  h$muMedian <- -h$muMedian
  h$muCI <- c(-h$muCI[2], -h$muCI[1])
}

row <- function(name, hv, qv) {
  cat(sprintf("%-12s %14.6f %14.6f %14.6f\n", name, hv, qv, qv - hv))
}
cat(sprintf("%-12s %14s %14s %14s\n", "field", "phacking", "quadrature", "quad-hmc"))
row("mu mode", h$mu, q$mu)
row("mu median", h$muMedian, q$muMedian)
row("mu CI lo", h$muCI[1], q$muCI[1])
row("mu CI hi", h$muCI[2], q$muCI[2])
row("tau mode", h$tau, q$tau)
row("tau median", h$tauMedian, q$tauMedian)
row("tau CI lo", h$tauCI[1], q$tauCI[1])
row("tau CI hi", h$tauCI[2], q$tauCI[2])
cat(sprintf(
  "\nphacking (HMC): %.1fs   quadrature: %.2fs   k nonaffirmative: %d of %d\n",
  hmc_secs, quad_secs, q$kNonaffirm, q$k
))
cat(sprintf(
  "quadrature grid: %d expansions, boundary mass %.1e\n",
  q$grid$expansions, q$grid$edge_frac
))
