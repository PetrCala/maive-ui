# Task Prompt: Fix MAIVE Bootstrap Confidence Interval Naming Error

## Background
The Lambda integration for the MAIVE package is currently failing whenever the
model is executed with bootstrap standard errors enabled. The backend calls the
MAIVE helper `maive_prepare_confidence_interval` during bootstrap post-processing.
When the bootstrap routine returns a single-value vector (or a vector whose row
names are missing), the helper blindly assigns `c("lower", "upper")` as the
`names` attribute. In those degenerate cases the assignment throws
```
'names' attribute [2] must be the same length as the vector [1]
```
which bubbles up to the API and aborts the request.

## Reproduction Steps
1. In the MAIVE repository, run the following R script (the tibble matches the
   failing Lambda payload):
   ```r
   suppressPackageStartupMessages(library(MAIVE))

   df <- data.frame(
     effect = c(-1, 2, -2, 4, -5, 4),
     se = c(1.2102206, 0.7934484, 2.6398007, 1.5258374, 2.7639093, 1.8604979),
     n_obs = rep(c(543L, 529L), each = 3),
     study_id = rep("Lin et al", 6)
   )

   params <- list(
     modelType = "MAIVE",
     includeStudyDummies = TRUE,
     includeStudyClustering = TRUE,
     standardErrorTreatment = "bootstrap",
     computeAndersonRubin = TRUE,
     maiveMethod = "PET-PEESE",
     weight = "equal_weights",
     shouldUseInstrumenting = TRUE,
     useLogFirstStage = FALSE,
     winsorize = FALSE
   )

   MAIVE:::maive_model(df, params)
   ```
2. The model execution should stop with the `names` attribute length mismatch
   error above.

## Task Requirements
- Patch `maive_prepare_confidence_interval` (and any downstream helpers it
  relies on) so that it gracefully handles bootstrap outputs with fewer than two
  finite entries. Degenerate results should return a two-element vector whose
  `names` attribute is `c("lower", "upper")`, even when both values are `NA`.
- Ensure the fix covers both scenarios where the bootstrap matrix lacks row
  names and where it returns a single-element vector.
- Add unit tests exercising the patched code paths, verifying that the helper
  no longer raises when supplied with `NA_real_`, scalar, or single-row
  bootstrap outputs.

## Acceptance Criteria
- Running the reproduction script succeeds and returns a MAIVE model object with
  finite or `NA` confidence interval bounds instead of throwing.
- Newly added tests pass locally and fail when run against the pre-fix code.
- No regressions in the existing MAIVE test suite (`devtools::test()` or the
  repository's canonical test command).
