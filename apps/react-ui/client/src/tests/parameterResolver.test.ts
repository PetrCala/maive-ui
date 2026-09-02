import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  RECIPES,
  RECIPE_NAMES,
  describeDataShape,
  detectRecipe,
  fromPageParameters,
  resolveRunParameters,
  toPageParameters,
  type DataShape,
  type RecipeName,
  type ResolvedRun,
} from "@src/lib/parameterResolver";
import CONFIG from "@src/CONFIG";
import type { ModelParameters } from "@src/types/api";

const FOUR_COLUMN: DataShape = { hasStudyIdColumn: true, hasNObsColumn: true };
const THREE_COLUMN: DataShape = {
  hasStudyIdColumn: false,
  hasNObsColumn: true,
};
const TWO_COLUMN: DataShape = { hasStudyIdColumn: false, hasNObsColumn: false };

type ParityCase = {
  name: string;
  family: "maive" | "rtma";
  dataShape: DataShape;
  parameters: Record<string, unknown>;
  expected?: Record<string, unknown>;
  expectedRecipe?: RecipeName | null;
  expectedErrorContains?: string;
};

// The same fixture the R e2e scenario (resolver_parity_test.R) posts to the
// live backend; the two resolvers are pinned to each other through it.
const PARITY_FIXTURE = path.resolve(
  __dirname,
  "../../../../lambda-r-backend/r_scripts/tests/e2e/fixtures/resolver_parity.json",
);

const resolveOk = (
  input: Parameters<typeof resolveRunParameters>[0],
): ResolvedRun => {
  const result = resolveRunParameters(input);
  expect(result.error).toBeUndefined();
  if (!result.resolved) {
    throw new Error("expected parameters to resolve");
  }
  return result.resolved;
};

const resolveError = (
  input: Parameters<typeof resolveRunParameters>[0],
): string => {
  const result = resolveRunParameters(input);
  expect(result.resolved).toBeUndefined();
  if (!result.error) {
    throw new Error("expected a validation error");
  }
  return result.error.message;
};

describe("resolveRunParameters (shared browser/API resolver)", () => {
  it("turns study clustering on for a four-column upload, exactly as the browser did", () => {
    const { parameters, recipe } = resolveOk({ dataShape: FOUR_COLUMN });
    expect(parameters).toMatchObject({
      modelType: "MAIVE",
      includeStudyClustering: true,
      standardErrorTreatment: "clustered_cr2",
      shouldUseInstrumenting: true,
    });
    expect(recipe).toBe("MAIVE");
  });

  it("leaves study clustering off without a study_id column", () => {
    const { parameters } = resolveOk({ dataShape: THREE_COLUMN });
    expect(parameters).toMatchObject({ includeStudyClustering: false });
  });

  it("ties clustering to the standard error treatment on four-column data", () => {
    const { parameters } = resolveOk({
      dataShape: FOUR_COLUMN,
      parameters: { standardErrorTreatment: "not_clustered" },
    });
    expect(parameters).toMatchObject({ includeStudyClustering: false });
  });

  it("cascades WLS to standard weights and no instrumenting", () => {
    const { parameters, recipe } = resolveOk({
      dataShape: THREE_COLUMN,
      parameters: { modelType: "WLS" },
    });
    expect(parameters).toMatchObject({
      modelType: "WLS",
      weight: "standard_weights",
      shouldUseInstrumenting: false,
      computeAndersonRubin: false,
    });
    expect(recipe).toBe("PET-PEESE");
  });

  it("keeps an explicit compatible weight on WLS", () => {
    const { parameters } = resolveOk({
      dataShape: THREE_COLUMN,
      parameters: { modelType: "WLS", weight: "study_weights" },
    });
    expect(parameters).toMatchObject({ weight: "study_weights" });
  });

  it("normalizes MAIVE without instrumenting to WLS", () => {
    const { parameters, recipe } = resolveOk({
      dataShape: THREE_COLUMN,
      parameters: { maiveMethod: "PET-PEESE", shouldUseInstrumenting: false },
    });
    expect(parameters).toMatchObject({
      modelType: "WLS",
      shouldUseInstrumenting: false,
    });
    expect(recipe).toBe("PET-PEESE");
  });

  it("defaults a two-column upload to RTMA in lenient (browser) mode", () => {
    const { parameters, recipe } = resolveOk({
      dataShape: TWO_COLUMN,
      mode: "lenient",
    });
    expect(parameters).toEqual({
      modelType: "RTMA",
      favorPositive: true,
      alphaSelect: 0.05,
      ciLevel: 0.95,
      winsorize: 0,
    });
    expect(recipe).toBe("RTMA");
  });

  it("rejects a MAIVE-family model on a two-column upload in strict mode", () => {
    expect(
      resolveError({
        dataShape: TWO_COLUMN,
        parameters: { modelType: "MAIVE" },
      }),
    ).toMatch(/no n_obs/);
    // The API never picks a model the caller did not name.
    expect(resolveError({ dataShape: TWO_COLUMN })).toMatch(
      /set modelType to RTMA/,
    );
  });

  describe("named recipes", () => {
    it.each(RECIPE_NAMES)("expands %s to its preset", (name) => {
      const recipe = RECIPES[name];
      const shape = recipe.family === "rtma" ? TWO_COLUMN : FOUR_COLUMN;
      const resolved = resolveOk({ dataShape: shape, recipe: name });
      expect(resolved.parameters).toMatchObject(recipe.parameters);
      expect(resolved.recipe).toBe(name);
    });

    it("runs conventional PET-PEESE and EK as WLS with standard weights", () => {
      expect(
        resolveOk({ dataShape: FOUR_COLUMN, recipe: "PET-PEESE" }).parameters,
      ).toMatchObject({
        modelType: "WLS",
        maiveMethod: "PET-PEESE",
        shouldUseInstrumenting: false,
        weight: "standard_weights",
        includeStudyClustering: true,
      });
      expect(
        resolveOk({ dataShape: FOUR_COLUMN, recipe: "EK" }).parameters,
      ).toMatchObject({
        modelType: "WLS",
        maiveMethod: "EK",
        shouldUseInstrumenting: false,
      });
    });

    it("applies caller parameters on top of the recipe", () => {
      const { parameters } = resolveOk({
        dataShape: THREE_COLUMN,
        recipe: "MAIVE",
        parameters: { winsorize: 5 },
      });
      expect(parameters).toMatchObject({ modelType: "MAIVE", winsorize: 5 });
    });

    it("rejects a recipe on the wrong endpoint family", () => {
      expect(
        resolveError({
          dataShape: TWO_COLUMN,
          recipe: "RTMA",
          family: "maive",
        }),
      ).toMatch(/use \/v1\/run-rtma/);
      expect(
        resolveError({ dataShape: FOUR_COLUMN, recipe: "EK", family: "rtma" }),
      ).toMatch(/runs RTMA only/);
    });

    it("rejects an unknown recipe name", () => {
      expect(resolveError({ recipe: "PEESE-PET" })).toMatch(
        /Invalid recipe value: PEESE-PET/,
      );
    });
  });

  describe("unknown keys", () => {
    it("rejects a misspelled MAIVE-family key, naming it", () => {
      expect(
        resolveError({
          dataShape: THREE_COLUMN,
          parameters: { favourPositive: true },
        }),
      ).toMatch(/Unknown MAIVE-family parameter key: favourPositive/);
    });

    it("rejects a misspelled RTMA key, naming it", () => {
      expect(
        resolveError({
          dataShape: TWO_COLUMN,
          parameters: { modelType: "RTMA", favourPositive: true },
        }),
      ).toMatch(/Unknown RTMA parameter key: favourPositive/);
    });

    it("names every unknown key at once", () => {
      expect(resolveError({ parameters: { foo: 1, bar: 2 } })).toMatch(
        /Unknown MAIVE-family parameter keys: foo, bar/,
      );
    });
  });

  describe("conflicts", () => {
    it("rejects adjusted weights without instrumenting in strict mode", () => {
      expect(
        resolveError({
          parameters: { modelType: "WLS", weight: "adjusted_weights" },
        }),
      ).toMatch(/adjusted weights require instrumenting/);
    });

    it("switches adjusted weights to standard weights in lenient mode and reports it", () => {
      const resolved = resolveOk({
        parameters: { modelType: "WLS", weight: "adjusted_weights" },
        mode: "lenient",
      });
      expect(resolved.parameters).toMatchObject({ weight: "standard_weights" });
      expect(resolved.adjustments).toEqual([
        expect.objectContaining({
          param: "weight",
          from: "adjusted_weights",
          to: "standard_weights",
        }),
      ]);
    });

    it("rejects WAIVE with a method other than PET-PEESE", () => {
      expect(
        resolveError({ parameters: { modelType: "WAIVE", maiveMethod: "EK" } }),
      ).toMatch(/WAIVE only supports PET-PEESE/);
    });

    it("rejects the Anderson-Rubin CI with standard weights", () => {
      expect(
        resolveError({
          parameters: {
            computeAndersonRubin: true,
            weight: "standard_weights",
          },
        }),
      ).toMatch(/Anderson-Rubin CI is not available with standard weights/);
    });

    it("rejects explicit study clustering without a study_id column", () => {
      expect(
        resolveError({
          dataShape: THREE_COLUMN,
          parameters: { includeStudyClustering: true },
        }),
      ).toMatch(/Invalid includeStudyClustering value: true conflicts/);
    });

    it("rejects modelType given twice with different values", () => {
      expect(
        resolveError({ modelType: "WLS", parameters: { modelType: "MAIVE" } }),
      ).toMatch(/given twice/);
    });
  });

  describe("RTMA", () => {
    it("keeps a caller seed and validates it", () => {
      const { parameters } = resolveOk({
        dataShape: TWO_COLUMN,
        modelType: "RTMA",
        parameters: { seed: 42 },
      });
      expect(parameters).toMatchObject({ modelType: "RTMA", seed: 42 });
      expect(
        resolveError({ modelType: "RTMA", parameters: { seed: 0 } }),
      ).toMatch(/Invalid seed value/);
      expect(
        resolveError({ modelType: "RTMA", parameters: { seed: 1.5 } }),
      ).toMatch(/Invalid seed value/);
    });

    it("leaves the seed out when the caller did not set one", () => {
      const { parameters } = resolveOk({ modelType: "RTMA" });
      expect(parameters).not.toHaveProperty("seed");
    });
  });

  describe("value validation", () => {
    it("rejects invalid enum values instead of silently defaulting", () => {
      expect(resolveError({ parameters: { maiveMethod: "PETX" } })).toMatch(
        /Invalid maiveMethod value: PETX/,
      );
      expect(resolveError({ parameters: { weight: "heavy" } })).toMatch(
        /Invalid weight value/,
      );
    });

    it("rejects non-boolean flags and out-of-range numbers", () => {
      expect(
        resolveError({ parameters: { includeStudyDummies: "yes" } }),
      ).toMatch(/Invalid includeStudyDummies value/);
      expect(resolveError({ parameters: { winsorize: 150 } })).toMatch(
        /Invalid winsorize value/,
      );
      expect(
        resolveError({ modelType: "RTMA", parameters: { ciLevel: 1.5 } }),
      ).toMatch(/Invalid ciLevel value/);
    });

    it("rejects a non-object parameters field", () => {
      expect(resolveError({ parameters: [1, 2] })).toMatch(
        /must be a JSON object/,
      );
    });
  });
});

describe("resolver parity fixture", () => {
  const fixture = JSON.parse(readFileSync(PARITY_FIXTURE, "utf8")) as {
    cases: ParityCase[];
  };

  it("has cases", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))(
    "%s",
    (_name, parityCase) => {
      const result = resolveRunParameters({
        dataShape: parityCase.dataShape,
        parameters: parityCase.parameters,
        family: parityCase.family,
        mode: "strict",
      });
      if (parityCase.expectedErrorContains) {
        expect(result.error?.message).toContain(
          parityCase.expectedErrorContains,
        );
        return;
      }
      expect(result.error).toBeUndefined();
      expect(result.resolved?.parameters).toEqual(parityCase.expected);
      expect(result.resolved?.recipe).toBe(parityCase.expectedRecipe);
    },
  );
});

describe("page parameter helpers", () => {
  it("describes a dataset by its optional columns", () => {
    expect(
      describeDataShape([{ effect: 1, se: 1, n_obs: 3, study_id: "a" }]),
    ).toEqual(FOUR_COLUMN);
    expect(describeDataShape([{ effect: 1, se: 1, n_obs: 3 }])).toEqual(
      THREE_COLUMN,
    );
    expect(describeDataShape([{ effect: 1, se: 1 }])).toEqual(TWO_COLUMN);
    expect(describeDataShape([{ a: 1, b: 2, c: 3, d: 4 }])).toMatchObject({
      hasStudyIdColumn: true,
    });
    expect(describeDataShape([])).toEqual({
      hasStudyIdColumn: false,
      hasNObsColumn: false,
    });
  });

  it("widens an RTMA run onto the page's ModelParameters shape and back", () => {
    const page = toPageParameters({
      modelType: "RTMA",
      favorPositive: false,
      alphaSelect: 0.05,
      ciLevel: 0.95,
      winsorize: 3,
      seed: 7,
    });
    expect(page).toMatchObject({
      ...CONFIG.DEFAULT_MODEL_PARAMETERS,
      modelType: "RTMA",
      shouldUseInstrumenting: false,
      favorPositive: false,
      winsorize: 3,
    });
    expect(fromPageParameters(page)).toEqual({
      modelType: "RTMA",
      favorPositive: false,
      winsorize: 3,
    });
    const maive: ModelParameters = { ...CONFIG.DEFAULT_MODEL_PARAMETERS };
    expect(fromPageParameters(maive)).toBe(maive);
    expect(toPageParameters(maive)).toBe(maive);
  });

  it("detects the recipe from resolved parameters", () => {
    expect(detectRecipe({ ...CONFIG.DEFAULT_MODEL_PARAMETERS })).toBe("MAIVE");
    expect(
      detectRecipe({
        ...CONFIG.DEFAULT_MODEL_PARAMETERS,
        modelType: "WLS",
        maiveMethod: "EK",
        shouldUseInstrumenting: false,
      }),
    ).toBe("EK");
    expect(
      detectRecipe({ ...CONFIG.DEFAULT_MODEL_PARAMETERS, maiveMethod: "PET" }),
    ).toBeNull();
  });
});
