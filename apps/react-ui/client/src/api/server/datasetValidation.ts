import CONST from "@src/CONST";

// Server-side validation for the public `/v1/runs` submit endpoint (design
// §6.2). Mirrors the rules on the UI's validation page
// (`src/pages/validation/index.tsx`), adapted for arbitrary JSON row objects
// resolved by canonical column name with positional fallback (D5), since API
// callers don't go through the UI's interactive column-mapping step.

export const MIN_MAIVE_ROWS = 4;

// Upper bound on dataset rows accepted by the public API. A cost/abuse control,
// not a statistical limit: it caps the per-request work an anonymous caller can
// trigger, independent of the R Lambda's concurrency cap and timeout. Set far
// above any realistic meta-analysis (largest known are a few thousand
// estimates), so it never blocks genuine use. Keep in sync with MAX_INPUT_ROWS
// in the R backend (api_v1.R / index.R).
export const MAX_ROWS = 50000;

export type ResolvedColumns = {
  effect: string;
  se: string;
  nObs?: string;
  studyId?: string;
  /** True when resolved by canonical names rather than positionally. */
  byName: boolean;
};

export type ValidationError = { message: string };

const findKeyCaseInsensitive = (
  row: Record<string, unknown>,
  name: string,
): string | undefined =>
  Object.keys(row).find((key) => key.toLowerCase() === name);

/**
 * Resolves the effect/se/n_obs/study_id columns from the first row: by
 * canonical name when `effect`, `se`, and `n_obs` are all present; otherwise
 * positionally, taking the first 3-4 keys in order (D5). Positional fallback
 * also covers RTMA's 2-column (effect, se) shape.
 */
export const resolveColumns = (
  rows: Array<Record<string, unknown>>,
): ResolvedColumns | null => {
  const first = rows[0];
  if (!first) {
    return null;
  }

  const effectKey = findKeyCaseInsensitive(first, "effect");
  const seKey = findKeyCaseInsensitive(first, "se");
  const nObsKey = findKeyCaseInsensitive(first, "n_obs");
  const studyIdKey = findKeyCaseInsensitive(first, "study_id");

  if (effectKey && seKey && nObsKey) {
    return {
      effect: effectKey,
      se: seKey,
      nObs: nObsKey,
      studyId: studyIdKey,
      byName: true,
    };
  }

  const keys = Object.keys(first);
  if (keys.length < 2) {
    return null;
  }
  return {
    effect: keys[0],
    se: keys[1],
    nObs: keys[2],
    studyId: keys[3],
    byName: false,
  };
};

const isFiniteNumber = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value));
  }
  return false;
};

const toNumber = (value: unknown): number =>
  typeof value === "number" ? value : Number(value);

export const validateDataset = (
  data: unknown,
  modelType: string,
): ValidationError | null => {
  if (!Array.isArray(data) || data.length === 0) {
    return { message: "`data` must be a non-empty array of row objects." };
  }

  if (data.length > MAX_ROWS) {
    return {
      message: `Data must contain at most ${MAX_ROWS} rows; found ${data.length}.`,
    };
  }

  const hasInvalidRow = data.some(
    (row) => typeof row !== "object" || row === null || Array.isArray(row),
  );
  if (hasInvalidRow) {
    return { message: "Each row in `data` must be a JSON object." };
  }

  const rows = data as Array<Record<string, unknown>>;
  const columns = resolveColumns(rows);
  const isRtma = modelType === CONST.MODEL_TYPES.RTMA;

  if (!columns?.effect || !columns.se) {
    return {
      message:
        "Could not resolve `effect` and `se` columns from `data`. Use canonical names (effect, se[, n_obs, study_id]) or provide them positionally.",
    };
  }

  if (!isRtma) {
    // Positional resolution requires exactly 3-4 columns (matching the sync R
    // path); by-name resolution tolerates extra columns since they're ignored.
    const totalKeys = Object.keys(rows[0]).length;
    if (!columns.byName && (totalKeys < 3 || totalKeys > 4)) {
      return {
        message: `Data must have 3 or 4 columns; found ${totalKeys}.`,
      };
    }

    if (!columns.nObs) {
      return {
        message: `Data must have 3 or 4 columns; found ${totalKeys}.`,
      };
    }

    if (rows.length < MIN_MAIVE_ROWS) {
      return {
        message: `Data must contain at least ${MIN_MAIVE_ROWS} rows; found ${rows.length}.`,
      };
    }
  }

  const nonNumericColumn = (
    key: string,
    label: string,
  ): ValidationError | null =>
    rows.some((row) => !isFiniteNumber(row[key]))
      ? { message: `The \`${label}\` column contains non-numeric values.` }
      : null;

  const effectError = nonNumericColumn(columns.effect, "effect");
  if (effectError) {
    return effectError;
  }

  const seError = nonNumericColumn(columns.se, "se");
  if (seError) {
    return seError;
  }

  if (!isRtma && columns.nObs) {
    const nObsError = nonNumericColumn(columns.nObs, "n_obs");
    if (nObsError) {
      return nObsError;
    }
  }

  const hasNonPositiveSe = rows.some((row) => toNumber(row[columns.se]) <= 0);
  if (hasNonPositiveSe) {
    return {
      message:
        "The `se` column must contain only positive values (greater than 0).",
    };
  }

  if (!isRtma && columns.nObs) {
    const nObsKey = columns.nObs;
    const hasInvalidNObs = rows.some((row) => {
      const value = toNumber(row[nObsKey]);
      return value <= 0 || !Number.isInteger(value);
    });
    if (hasInvalidNObs) {
      return {
        message:
          "The `n_obs` column must contain only positive integers (greater than 0).",
      };
    }
  }

  if (!isRtma && columns.studyId) {
    const studyIdKey = columns.studyId;
    const studyIds = rows.map((row) => row[studyIdKey]);

    const hasEmptyStudyId = studyIds.some(
      (value) =>
        value === undefined || value === null || String(value).trim() === "",
    );
    if (hasEmptyStudyId) {
      return {
        message:
          "The `study_id` column contains empty values. Study IDs can be strings or numbers.",
      };
    }

    const uniqueStudyIds = new Set(studyIds.map((value) => String(value))).size;

    if (rows.length < uniqueStudyIds + 3) {
      return {
        message:
          "The number of rows must be larger than the number of unique study IDs plus 3.",
      };
    }
  }

  return null;
};
