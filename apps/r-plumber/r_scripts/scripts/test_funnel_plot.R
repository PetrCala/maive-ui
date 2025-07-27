source("apps/r-plumber/r_scripts/modules/funnel_plot.R")

df <- readxl::read_excel("lib/funnel_data.xlsx")

effect <- df$pcc
se <- df$se_pcc
se_adjusted <- df$se_pcc + runif(nrow(df), 0, 0.01)

intercept <- 0.1
intercept_se <- 0.2
is_quaratic_fit <- TRUE

get_funnel_plot(
  effect = effect,
  se = se,
  se_adjusted = se_adjusted,
  intercept = intercept,
  intercept_se = intercept_se,
  is_quaratic_fit = is_quaratic_fit
)
