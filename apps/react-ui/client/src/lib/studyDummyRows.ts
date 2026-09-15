/**
 * The rows-per-study rule for study dummies (#23), shared by the validation
 * page and the API's server-side validation.
 *
 * Study dummies add one regressor per study, so a dummy fit needs the unique
 * studies plus the intercept, the slope and one residual degree of freedom.
 * Clustering by study spends none of those, and MAIVE 0.4.0 and later apply
 * the rule only when dummies are fitted, so callers must too.
 */

/** The fewest rows a study-dummy fit needs for this many unique studies. */
export const minRowsForStudyDummies = (uniqueStudyIds: number): number =>
  uniqueStudyIds + 3;

/**
 * API refusal for a study-dummy run with too few rows. api_v1.R
 * (api_v1_check_study_dummy_rows) returns the same text, so the sync and the
 * async endpoints agree.
 */
export const studyDummyRowsMessage = (
  rows: number,
  uniqueStudyIds: number,
): string =>
  "Study dummies add one regressor per study, so they need at least " +
  `${minRowsForStudyDummies(uniqueStudyIds)} rows for ${uniqueStudyIds} ` +
  `unique study IDs (the unique study IDs plus 3); found ${rows}. Set ` +
  "includeStudyDummies to false: clustering by study works on this data.";
