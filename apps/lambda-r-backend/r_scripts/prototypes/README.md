# RTMA prototypes

Research prototypes from the RTMA performance investigation written up in
[docs/RTMA_PERFORMANCE.md](../../../../docs/RTMA_PERFORMANCE.md). Nothing in
this directory is sourced by the production path; `rtma_model.R` still calls
`phacking::phacking_meta()` unchanged.

## rtma_quadrature.R

Deterministic evaluation of the exact RTMA posterior (Mathur 2024, as
implemented by phacking 0.2.1) by 2D quadrature over (mu, tau) instead of
HMC. Same likelihood, same Jeffreys prior, same nonaffirmative subset, same
Nelder-Mead optimisation for the mode; the median and equal-tailed credible
intervals come from gridded marginals rather than 4000 MCMC draws.

Properties, measured on the datasets in the report:

- 0.5 to 4 s per fit on datasets where the sampler needs 2 to 10 s on good
  seeds and minutes on bad ones; no seed, no Monte Carlo noise, flat runtime
  on the pathological cases.
- Needs no rstan at runtime (base R + stats4 only).
- On weakly identified data it integrates the posterior's heavy upper shelf
  exactly, where short HMC runs report seed-dependent intervals. The two
  engines then disagree because the sampler under-covers the tail; see the
  report before treating either number as the answer.

## rtma_quadrature_check.R

Comparison CLI. Point it at a CSV with effect sizes in column 1 and standard
errors in column 2:

```bash
Rscript rtma_quadrature_check.R data.csv 2025 TRUE
```

Prints both engines' summaries and the differences, plus timings and grid
diagnostics.
