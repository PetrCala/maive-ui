# RTMA Performance and Memory Profile

Research findings on making the RTMA fit (phacking 0.2.1, Mathur 2024) faster
and leaner without changing its answers. This is a benchmarking and analysis
report; no production behaviour was changed in the session that produced it.
Prototype code lives in `apps/lambda-r-backend/r_scripts/prototypes/` and is
not sourced by the production path.

Benchmarks were run on an Apple M2 (8 GB, macOS, R 4.5.1, phacking 0.2.1,
rstan 2.32.7). Absolute numbers on the production Lambda (Amazon Linux 2023,
x86_64, 2048 MB, ~1.15 vCPU) will differ; the structure of where time and
memory go carries over. Every wall-clock claim below is the median of repeated
runs unless stated otherwise; seeds are always pinned and reported.

## 1. What RTMA actually computes

`phacking::phacking_meta()` does the following (all confirmed by reading the
installed 0.2.1 source):

1. Fits `metafor::rma(yi, vi, method = "FE")` for a direction sanity warning.
2. Flips `yi <- -yi` when `favor_positive` is FALSE.
3. Splits estimates at `z = yi/sei > tcrit` (`tcrit = qnorm(1 - alpha/2)`).
   Affirmative estimates are discarded; only the nonaffirmative subset (size
   `k_nonaffirm`) reaches the sampler.
4. Samples a 2-parameter posterior over `(mu, tau)` with RStan:
   - Likelihood: right-truncated normal, closed form and separable over
     studies. With `S_i = sqrt(tau^2 + sei_i^2)` and upper truncation at
     `tcrit * sei_i`:

     ```text
     log L(mu, tau) = sum_i [ log phi((y_i - mu)/S_i) - log S_i
                              - log Phi((tcrit*sei_i - mu)/S_i) ]
     ```

   - Prior: Jeffreys, `sqrt(det(sum_i FisherInfo_i(mu, tau)))`, with
     closed-form per-study Fisher entries (same `cz`, Mills-ratio terms the
     likelihood uses).
   - Sampler settings hardcoded as defaults: `adapt_delta = 0.98`,
     `max_treedepth = 20`, rstan defaults otherwise (4 chains, 2000
     iterations, 1000 warmup, 4000 retained draws), fixed inits
     `mu = 0, tau = 1`.
5. Reports, per parameter:
   - mode: a separate `stats4::mle` Nelder-Mead optimisation of the exact
     negative log posterior, started from the best draw (a MAP, despite the
     `mle_params` name),
   - median and equal-tailed CI: quantiles of the retained draws,
   - `r_hat`, `n_eff`, `se_mean`: rstan summary output.

Two structural facts drive everything below:

- The posterior is 2-dimensional with a closed-form, cheap log-density.
  Nothing about the method requires MCMC; HMC is one way to integrate it.
- Only nonaffirmative estimates enter the sampler, so the Stan data can be
  far smaller than the uploaded dataset (the e2e "precise estimates" fixture
  has n = 75 rows but k_nonaffirm = 4).

## 2. Where time goes today

Instrumented stage timings from a staged replica of `phacking_meta()`'s
exact call sequence, verified bit-identical to the stock call under the same
seed (every reported digit of mu, tau, CIs, r_hat, n_eff matched). Happy
path, e2e RTMA fixture (n = 40, k_nonaffirm = 26), seed 2025:

| stage | seconds | share of request |
| --- | --- | --- |
| `library(phacking)` (cold attach, per process) | 4.0 | paid once per Lambda container |
| `metafor::rma` FE direction check (first call) | 0.45 | lazy-load; ~0.02 s warm |
| `rstan::sampling`: warmup (4 chains x 1000) | 1.1-1.3 | ~45% of fit |
| `rstan::sampling`: sampling (4 chains x 1000) | 0.8-1.0 | ~35% of fit |
| rstan R-side glue around the chains | ~0.13 | |
| `rstan::extract` | 0.016 | |
| `mle_params` (Nelder-Mead MAP for the mode) | 0.02-0.06 | |
| `rstan::summary` + CI quantiles | 0.011 | |
| z-density plot render + base64 (when requested) | 0.17-0.35 | skipped with `include_plot = FALSE` |

Total per warm request: 2.3-2.7 s of which the HMC chains are ~2.2 s. The
sampler executed ~85k leapfrog steps (47k warmup, 38k sampling) at O(k) cost
each. Everything downstream of the chains is under 0.1 s; there is nothing
material to optimise outside the sampling itself.

Scaling: per-leapfrog cost is O(k_nonaffirm) with a microsecond-scale
constant, so datasets up to a few hundred estimates stay in seconds unless
the trajectory count explodes. The blowups (section 4) are trajectory-count
explosions on weakly identified data, not per-step cost, and are unrelated
to N: the worst offenders here have k_nonaffirm of 4 and 9.

Full benchmark matrix (HMC = the production phacking pipeline at stock
settings, seeds 2025, 4242, 7 plus repeats; "killed" = runs still grinding
at the external 720 s kill; spread = range of the reported mu CI upper bound
across completed seeds; quad = the deterministic prototype; shelf mass =
posterior probability that mu exceeds the largest truncation point,
computed by quadrature):

| dataset | k_NA | HMC sampling s (per seed) | killed >720 s | muCI_hi spread | quad s | shelf mass |
| --- | --- | --- | --- | --- | --- | --- |
| e2e_rtma40 | 26 | 2.0 / 2.0 / 2.1 / 2.2 | 0 | 0.07 | 0.7 | 1% |
| neg_mirror40 | 26 | 2.0 / 2.0 / 2.0 / 2.0 | 0 | 0.00 | 0.5 | 1% |
| demo_felts30 | 9 | 1.2 / 165.6 | 2 | 0.32 | 0.9 | 36% |
| demo_meissner29 | 13 | 1.5 / 2.0 / 2.0 / 41.8 | 0 | 0.79 | 1.3 | 28% |
| demo_large100 | 42 | 8.5 / 10.1 | 2 | 1.30 | 3.9 | 61% |
| e2e_precise75 | 4 | 0.6 / 0.6 / 0.8 / 0.9 / 1.3 | 1 | 1.09 | 0.6 | 6% |
| v1_deg40 | 24 | 2.1 / 2.2 / 2.5 | 1 | 0.05 | 1.2 | 34% |
| scale_n10 | 10 | 1.1 / 1.1 / 1.1 / 2.6 | 0 | 0.60 | 0.9 | 12% |
| scale_n100 | 70 | 6.5 / 6.6 / 6.6 / 6.7 | 0 | 0.02 | 0.9 | 0% |
| scale_n300 | 204 | 19.3 / 20.3 / 20.8 / 23.6 | 0 | 0.00 | 1.8 | 0% |
| scale_n1000 | 729 | 64.6 / 73.3 / 85.8 / 112.6 | 0 | 0.00 | 2.8 | 0% |
| scale_n3000 | 2161 | 189.2 / 215.7 / 225.1 / 235.3 | 0 | 0.00 | 8.6 | 0% |

Reading guide: runtime is flat in N on well-identified data until the O(k)
per-step cost takes over (scale_n100 through n3000: ~0.1 s per 10
nonaffirmative estimates, quadrature 8 to 25 times faster at the top end);
runtime and the reported interval both destabilise exactly where shelf mass
is high, regardless of N. The killed runs are all high-shelf datasets.

One environment caveat: which specific seeds grind is not portable. Seed
2026 on the precise fixture is listed as pathological in `rtma_model.R`
(observed in the Lambda environment) but completed in 1.3 s on the bench
machine, while 20250101 ground to the kill on both. Trajectories depend on
floating-point details (architecture, BLAS, R version), so the phenomenon
and its datasets are stable; the exact seed list is not.

Bit-reproducibility (the #479 guarantee) was confirmed in passing: repeated
runs with the same data and seed reproduce every digit, including leapfrog
counts.

## 3. Where memory goes today

Per-layer resident set size of a fresh R process on the bench machine:

| layer | RSS | load time |
| --- | --- | --- |
| bare R | 69 MB | 0.13 s |
| + jsonlite | 74 MB | 0.12 s |
| metafor alone | 177 MB | 0.58 s |
| rstan alone | 237 MB | 4.9 s |
| phacking attach (pulls rstan) | 223 MB | 4.4 s |
| plumber alone | 88 MB | 0.24 s |
| full production stack (plumber + metafor + phacking + ragg + base64enc) | 286 MB | 4.9 s |

A complete RTMA fit peaks around 335-350 MB process-wide; the fit object
itself is under 1 MB and the 4000 retained draws are a few hundred KB. In
other words, nearly the whole memory footprint is shared library code and
package namespaces, dominated by the rstan/StanHeaders/RcppParallel stack;
per-request data is noise. The 2048 MB Lambda allocation is not close to
memory-bound; it is sized to buy CPU (Lambda couples the two).

Consequences:

- Cutting draws, thinning, or `pars=` subsetting cannot move peak RSS by more
  than ~1 MB. Memory optimisation of the fit itself is a dead end.
- The only lever that moves the memory floor is not loading rstan at all
  (see the quadrature candidate), which also removes ~4.5 s of cold-start
  library load.

## 4. The pathological cases: what the blowup actually is

The known bad seed/dataset pairs named in `rtma_model.R` (e2e precise
fixture with seeds 20250101 and 2026; the /v1 near-degenerate fixture with
42 and 8454) are not sampler bad luck on an otherwise fine posterior. Two
new pairs surfaced during benchmarking: the /v1 fixture with seed 4242, and,
more importantly, the shipped demo dataset Felts.csv with seed 2025, which
is the production default seed. Both ground past 12 minutes and had to be
killed.

The mechanism, established by evaluating the posterior exactly:

- On weakly identified data (few nonaffirmative estimates, or degenerate
  spread), the RTMA posterior is not a single sharp mode. It has a sharp
  core at small tau plus a genuinely heavy shelf running diagonally out to
  large (mu, tau), at 1e-5 to 1e-8 of peak density but over an enormous
  area. The shelf is real probability mass, not an artifact: on Felts.csv
  the exact posterior puts about 24 percent of its mass at mu > 1 and its
  exact 97.5 percent quantile near 9, while the naive pooled mean is about
  0.9. The model is saying "a huge effect with huge heterogeneity, where
  almost everything got truncated, also explains these nonaffirmative
  estimates". With k_nonaffirm around 9 the data cannot rule that out.
- A chain whose trajectory finds the shelf needs very long trajectories to
  traverse it: tree depth rises to the max_treedepth = 20 ceiling, and a
  single iteration can cost 2^20 leapfrog steps. That is the grind. A chain
  that never finds the shelf finishes in seconds and reports a narrow
  interval. Same posterior, same settings, different seed.
- This is why the credible interval is so seed-sensitive exactly on the
  datasets that grind. On the e2e precise fixture (k_nonaffirm = 4) the
  reported mu CI upper bound across seeds 2025, 4242, 7 was 0.117, 1.209,
  0.276, with 0, 29, and 5 divergent transitions. The exact upper bound
  from quadrature is 0.52. Any single pinned-seed number on such data is
  one draw from a wide sampling distribution, and it systematically
  under-covers the shelf.
- The mode is unaffected: it comes from a deterministic optimisation
  anchored in the core, which is why it is stable while the interval and
  the runtime are not.

Two engineering corollaries:

- `setTimeLimit` cannot interrupt a grinding chain. R checks elapsed-time
  limits at R-level interrupt points, and rstan's C++ sampling loop for a
  chain does not return to R until the chain finishes. A 180 s budget was
  observed to overshoot to 12+ minutes (killed externally). Production's
  480 s budget has the same hole: a truly bad request dies as an opaque
  Lambda 600 s hard kill, not as the clean timeout error the wrapper tries
  to produce.
- Because only trajectory length explodes (per-step cost is O(k_nonaffirm)
  and k is tiny on exactly the weak datasets), capping max_treedepth bounds
  the damage multiplicatively: depth 12 caps an iteration at 2^12 = 4096
  leapfrog steps, 256 times less than depth 20's ceiling.

## 5. Candidates considered

Every candidate below names the mechanism by which it would save time or
memory. Ones with no nameable mechanism were dropped without benchmarking.

**A. Deterministic quadrature over the exact posterior** (prototyped,
`prototypes/rtma_quadrature.R`). The posterior is 2-dimensional with a
closed-form log density, so integrate it on a sinh-transformed grid instead
of sampling. Mechanism: replaces 85k+ leapfrog steps (each an O(k) density
plus gradient) with ~80k plain density evaluations, no warmup, no
adaptation, no seed. Also removes rstan from the runtime path entirely
(~150 MB RSS, ~4.5 s load, ~220 MB image). Runs 0.5 to 4 s on every
app-realistic dataset including all the ones that make the sampler grind
(8.6 s at k_nonaffirm = 2161, still 25x under HMC there). Two implementation
subtleties were required: line-max bound scans (a point check on one axis
misses the diagonal shelf) and asymptotically stable evaluation of the
Jeffreys Fisher terms and truncated log-likelihood for cz below -30, where
the textbook formulas (as written in phacking's own R and Stan code) cancel
catastrophically in doubles. HMC never visits that region, so upstream has
never been bitten.

**B. Cap max_treedepth via the stan_control argument** (benchmarked).
`phacking_meta(stan_control = list(adapt_delta = 0.98, max_treedepth = 12))`
is expressible today without forking phacking; 20 is just the default.
Mechanism: bounds the per-iteration leapfrog budget on shelf-encountering
chains by 2^(20-12) = 256x; fits whose trees never reach the cap are
bit-identical (verified). This is tail-latency insurance, not a speedup for
happy fits.

**C. Lower adapt_delta** (benchmarked). Mechanism: larger step sizes mean
shorter trajectories everywhere. Changes every draw stream (every pinned
result shifts within its Monte Carlo noise) and risks divergences near the
tau -> 0 funnel; measured below.

**D. MAP-informed inits** (benchmarked). Mechanism: chains starting at the
mode might avoid wandering onto the shelf during early warmup. Changes draw
streams. Measured below; the shelf is reachable from the core, so the prior
expectation was weak.

**E. Laplace / normal approximation** (prototyped, rejected). Mechanism:
two optimisations and a 2x2 Hessian instead of any integration; would be
~50 ms. Rejected on accuracy: the tau marginal is strongly skewed and the
mu marginal is shelf-fattened, so a Gaussian in (mu, log tau) misstates
both tails; numbers in section 6.

**F. Fewer iterations, thinning, pars= subsetting** (rejected without
benchmark). phacking_meta() does not expose iter/chains, so this requires
reimplementing its pipeline app-side; the retained-draws matrix is only a
few hundred KB and post-sampling stages cost under 0.1 s, so there is
nothing material to win beyond proportional sampling time, at the cost of
higher Monte Carlo error on the interval. n_eff is already only ~1200 of
4000 draws.

**G. cmdstanr / TMB / hand-rolled NUTS / Rust** (assessed, not built).
cmdstanr would cut the R-side rstan footprint (the model runs as a
subprocess writing CSVs) but adds the CmdStan toolchain to the image and
changes the draw stream anyway (different RNG); TMB and hand-rolled
samplers re-derive what quadrature already gives deterministically. All
dominated by A on this posterior: 2 parameters, closed-form density is the
easy case for quadrature and the hard case for justifying sampler
engineering.

**H. Vectorize the Stan model / collapse duplicate sei** (upstream note,
not built). The likelihood loop and the O(k) Jeffreys loop per leapfrog
step could vectorize, and studies with identical sei contribute identical
Fisher terms (the /v1 fixture has 40 copies of one sei). Mechanism:
constant-factor per-step savings. Irrelevant at k around 25 (per-step cost
is microseconds; trajectory length is the problem) and only material for
k in the thousands, which the app does not see. Would also change
floating-point summation order, breaking bit-reproducibility of pinned
seeds across versions.

**I. Memory reduction inside the fit** (rejected by measurement). The fit
object is under 1 MB against a ~340 MB process; see section 3. No lever.

**J. Parallel chains** (already settled). parallelize = FALSE is correct on
the 1.15 vCPU Lambda; forked chains were benchmarked upstream of this
session and add fork overhead for nothing.

## 6. Validation against the reference oracle

Design, fixed before any reference numbers were seen:

- **Reference oracle**: per dataset, three independent HMC runs at
  phacking's exact settings except iter = 26000 (4 chains x 25000 retained
  draws = 100k each, 300k total), seeds 900001..900003. Reference value =
  mean across runs; reference Monte Carlo error = SD across runs / sqrt(3).
  If the first reference cannot finish inside 18 minutes, one confirmation
  run is attempted and the dataset is recorded as "HMC cannot cheaply
  provide a reference".
- **Production-noise yardstick**: 8 fits at stock settings (iter = 2000),
  seeds 1..8, hard-capped at 120 s each. The SD across seeds is the Monte
  Carlo noise a single pinned-seed production value carries; the timeouts
  are grind frequency.
- **Acceptance criterion**: modes must match to 1e-3 (same optimisation
  target); medians and CI bounds must satisfy |candidate - ref_mean| <=
  3 * ref_se + quadrature self-error (self-error = shift when doubling both
  grid resolutions).

Results (verdicts at that criterion; "pass*" = formal miss by under 2.5e-3
absolute, smaller than one unit of the production seed noise on the same
quantity, see discussion below):

| dataset | mode | median | mu CI | tau CI | laplace | quad s / ref s |
| --- | --- | --- | --- | --- | --- | --- |
| e2e_rtma40 | pass (2e-6) | pass / pass* | pass* lo, pass hi | pass* lo, pass hi | reject | 0.7 / 44 |
| neg_mirror40 | pass | pass | mirror-exact of e2e_rtma40 | same | reject | 1.0 / 39 |
| v1_deg40 | pass (4e-6) | pass | pass* lo, pass hi | pass | reject | 1.2 / 40 |
| e2e_precise75 | pass (6e-6) | pass | pass, pass | pass* median, pass bounds | reject | 0.9 / 53 |
| demo_meissner29 | pass (4e-6) | pass | lo pass*, **hi disagrees** | **hi disagrees** | reject | 1.8 / 95 |
| demo_felts30 | pass (1e-4) | pass | lo pass, **hi disagrees** | **hi disagrees** | reject | 0.9 / ref timeout |

Three layers of findings:

**1. On well-identified data the quadrature reproduces the implementation
within its own noise.** Every mode matches to a few parts in 1e6. Medians
and CI bounds land within 2.5e-3 absolute of the 300k-draw reference; the
handful of formal criterion misses (marked pass*) are all smaller than the
seed-to-seed noise of a single production fit on the same quantity, and
they lean one way on tau (quadrature slightly below HMC near the tau -> 0
boundary), which is the direction of HMC's known funnel bias under
divergences rather than of any quadrature resolution effect (self-error is
5 to 10 times smaller than the discrepancies, and stable under grid
doubling).

**2. On shelf-heavy data the sampler and the exact posterior genuinely
part ways, and the exact side is verifiable.** On demo_meissner29 the
reference says mu CI upper = 5.36 with SE 0.35 (the three 100k-draw runs
disagree among themselves by over 0.6); exact integration says 7.92. An
independent uniform-grid integration on a bounded box (different grid
geometry, 1.28M nodes) puts 3.4 percent of posterior mass above the
reference's "97.5 percent" quantile and its own within-box quantile at
7.27 against a box edge still at 1e-4 of peak density, i.e. the reference
under-covers the shelf even at 300k draws, with divergent transitions
present as the sampler's own admission.

demo_felts30 makes the under-coverage gradient explicit. The first
reference run could not finish 100k draws in 18 minutes while an identical
run under a different seed took 32 s. Across sampling depth, the reported
mu CI upper bound climbs monotonically toward the exact value: the four
production-length sweep fits that completed (four of eight ground to the
2-minute cap) report 3.98 to 4.96; the one completed 100k-draw run reports
6.66; exact integration gives 9.76 with a grid self-error of 0.14. The
longer the sampler runs, the more of the shelf it finds; no finite pinned
run reports the model's actual quantile. Grind rates at production
settings across the 8-seed sweeps: felts 4 of 8, meissner 2 of 8,
precise75 1 of 8, and 0 of 8 on each well-identified dataset.

**3. Laplace is rejected on every dataset** (modes fine, intervals wrong;
mu CI bounds off by 0.01 to 5 depending on shelf mass, tau intervals wrong
shape). Recorded so nobody retries it as a cheap interval.

The consequence for candidate A is the honest split already flagged in
section 5: the quadrature reproduces *the method's posterior* everywhere,
and reproduces *the shipped implementation's numbers* only where that
implementation converges. On weak data the shipped sampler's intervals are
seed lotteries that systematically under-cover the model's own tail, so no
faithful integrator can match them run for run. Swapping engines would
therefore change reported intervals on exactly the datasets where RTMA is
least trustworthy; keeping phacking and surfacing the shelf-mass
diagnostic changes nothing and tells the user when the interval is
unstable.

Reproduction: the benchmark harness lived in session scratch space per the
ground rules of the investigation and is fully specified above (datasets
mirror the e2e fixtures and `mockCsvFiles.ts` exactly; the staged HMC
replica is the `phacking_meta()` body with per-stage timers, verified
bit-identical). `prototypes/rtma_quadrature_check.R` reruns the
quadrature-vs-phacking comparison on any CSV in one command.

## 7. Recommendations

Ranked, with effort and risk. "Implement in this app" items change no
statistical method; they are configuration and plumbing.

### Implement in this app

**R1. Pass `stan_control = list(adapt_delta = 0.98, max_treedepth = 12)`
to `phacking_meta()`.** Effort: one line plus e2e expectation review. Risk:
low. Evidence: on fits whose trajectories never need depth 13+ (every
well-identified fixture measured), results are bit-identical to today's,
verified digit-for-digit at both depth 12 and 10. On the grinding pairs,
every previously unbounded run now completes in 0.6 to 165 s: the
recoverable ones (both e2e precise pairs, v1 fixture seeds 42 and 8454)
come back with healthy diagnostics (r_hat 1.005 to 1.03, n_eff 143 to
860), and the unrecoverable ones (Felts with seed 2025) come back fast
with r_hat 3+ and divergences, which the response's diagnostics block
(#480) already surfaces, instead of dying as an opaque Lambda timeout.
Depth 10 is too aggressive: it broke two otherwise-recoverable pairs
(r_hat 8 to 15). Note the cap does not make bad fits good; it makes them
fail fast and visibly, which is the correct behaviour for a posterior the
sampler cannot cover.

**R2. Fix the wall-clock timeout mechanism.** Effort: small-moderate.
Risk: low. `setTimeLimit` provably cannot interrupt a grinding chain
(section 4); with R1 in place the practical exposure shrinks a lot (worst
observed capped run: 165 s), but the guard as written still cannot enforce
its stated budget. Options: accept the Lambda kill as the real timeout and
say so in the error contract, or run the fit in a child process the
handler can actually kill.

**R3. Surface a weak-identification warning.** Effort: moderate. Risk: low
(adds information, changes no numbers). The shelf-mass diagnostic
separates stable from seed-unstable fits sharply: about 1 percent on
well-identified fixtures against 28 to 61 percent on every dataset whose
intervals swing by whole units across seeds and whose chains grind. The
quadrature prototype computes it in under 2 s with no new dependencies. A
response field plus a UI hint ("the credible interval is unstable on this
dataset; RTMA is weakly identified here") would tell users the one thing
the current output cannot: whether the interval they see means anything.
The nonaffirmative count alone is not a substitute: the /v1 fixture has
k_nonaffirm = 24 and 34 percent shelf mass.

### Propose upstream to phacking

**U1. The shelf phenomenon and the treedepth default.** The grinding, the
seed-dependent intervals, and the under-coverage are one mechanism that
belongs upstream: with few effective nonaffirmative studies the posterior
grows a heavy joint (mu, tau) shelf, HMC either grinds on it or misses it,
and no finite pinned run reports the model's actual tail quantile
(demo dataset: production-length runs say 4 to 5, one 100k-draw run says
6.7, exact integration says 9.8). max_treedepth = 20 as the shipped
default buys 256x more work per iteration than depth 12 with no observed
benefit on recoverable fits. Filed as a report, not a patch; the method
and its defaults are Mathur's call.

**U2. Numerically stable far-field formulas.** The Fisher combos in
`get_lprior` and the Stan model cancel catastrophically below cz of about
-30 (section 8). Harmless for HMC in practice, but any downstream user
integrating or optimising in the tail (as this investigation did) will hit
it; the stable series is ~15 lines.

**U3. The quadrature backend itself.** Deterministic, seed-free, under 2 s
on every validation dataset, exact on the tail, validated here against 300k-draw
references and independent integration. As an optional backend or
cross-check in phacking it would remove the Monte Carlo caveat from the
package's intervals. Offered with the validation tables; adopting it is an
upstream decision precisely because it changes reported intervals wherever
the sampler under-covers.

### Not worth it

- **Swapping the app's production engine to the quadrature.** It would
  report different (wider, more correct) intervals than the published
  implementation exactly on weak data, i.e. the app would silently
  disagree with `phacking::phacking_meta()` run locally by a reviewer.
  Fidelity to the citable implementation wins; keep the prototype as a
  cross-check.
- **MAP-informed inits.** Rescues runtime on some grinding pairs (Felts:
  1.5 s, r_hat 1.013) by steering chains away from the shelf, which makes
  the interval confidently core-only (4.08 against an exact 9.76). It
  converts a visible failure into an invisible one. Rejected.
- **Lower adapt_delta (0.90-0.95).** Rescued some pairs the depth cap
  alone did not (v1 seed 4242: 1.8 s, r_hat 1.003 at 0.95/12), but it
  changes every pinned result in the app for a marginal tail-latency win
  over R1, and Felts stays broken regardless. Revisit only if R1 proves
  insufficient in production.
- **Laplace, cmdstanr/TMB swaps, thinning, memory work inside the fit,
  parallel chains, Stan model vectorisation for this app's N range**:
  sections 5, 6 and 8; each rejected with numbers or dominated by the
  options above.

## 8. What was tried and did not work

Recorded so nobody re-runs these.

- **Uniform-grid quadrature, first attempt.** A single equal-spaced grid
  with point checks at the boundary midlines clipped real tail mass: the
  posterior's heavy shelf runs diagonally, so a check at (mu_edge,
  tau_MAP) passes while density at (mu_edge, larger tau) is 5 orders of
  magnitude higher. Once the boundary check was fixed, a single-resolution
  grid then could not cover core and shelf simultaneously: expanded to the
  shelf's true extent, only ~7 cells covered the core and the quantiles
  went to slop. Both failures are structural; the working design (line-max
  bound scans, sinh-spaced axes, mass-weighted edge criterion) is in the
  prototype.
- **Boundary criterion on unweighted cell sums.** Comparing raw density
  sums at the edge misses that far cells represent enormous widths;
  everything must be mass-weighted (density times trapezoid weight) or the
  fat shelf looks negligible when it is not.
- **The textbook Fisher-information formulas in the far field.** The
  Jeffreys-prior combos (cz*r + r^2 - 1 and relatives, exactly as written
  in phacking's R and Stan sources) cancel catastrophically for cz below
  about -30 and are pure floating-point noise by cz ~ -1e4, which poisoned
  the quadrature's tail with fake mass. Replaced beyond a = 30 by
  asymptotic series in the Mills-ratio excess (relative error ~1e-8 at the
  crossover, verified against direct evaluation at a = 8..30). HMC never
  visits that region, so this does not affect phacking's own results; it
  only bites integrators that actually evaluate the tail.
- **Laplace / normal approximation.** ~5 ms per fit, but rejected on
  accuracy: mu CI bounds off the reference by 0.1 to 0.5 on shelf-heavy
  datasets and the tau interval shape is wrong (numbers in section 6).
  Recorded as: cheap, and not the method.
- **`setTimeLimit` as the RTMA wall-clock guard.** Does not fire while an
  rstan chain is grinding; R only checks elapsed limits at R-level
  boundaries, which a single chain does not cross until it finishes. A
  180 s budget overshot to 12+ minutes repeatedly on the bench. Any real
  budget needs an external enforcement point (a subprocess kill, or the
  Lambda timeout itself).
- **Trimming memory inside the fit** (fewer draws, pars= subsetting,
  discarding the stanfit early): measured as pointless; every candidate
  object is under 1 MB against a ~340 MB process floor owned by shared
  libraries.
- **cmdstanr / TMB engine swaps**: not built (no toolchain in this
  environment, and both are dominated by quadrature for a 2-parameter
  closed-form posterior). If the dependency-diet motivation ever matters,
  quadrature achieves it more directly by removing the sampler entirely.
- **Parallel chains** (`parallelize = TRUE`): re-confirmed as a
  non-starter for the 1.15 vCPU Lambda; this was already known and encoded
  in the wrapper's default.
