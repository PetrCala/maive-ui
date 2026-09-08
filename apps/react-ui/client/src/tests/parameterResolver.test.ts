import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  RECIPES,
  RECIPE_NAMES,
  V1_ASYNC_TOP_LEVEL_KEYS,
  V1_SYNC_TOP_LEVEL_KEYS,
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
  /** Extra keys posted beside `data` and `parameters` (#574). */
  topLevel?: Record<string, unknown>;
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

  it("runs the first stage in logs by default for every instrumented model (#575)", () => {
    for (const modelType of ["MAIVE", "WAIVE"] as const) {
      const { parameters } = resolveOk({
        dataShape: THREE_COLUMN,
        parameters: { modelType },
      });
      expect(parameters).toMatchObject({
        modelType,
        shouldUseInstrumenting: true,
        useLogFirstStage: true,
      });
    }
    const { parameters: levels } = resolveOk({
      dataShape: THREE_COLUMN,
      parameters: { useLogFirstStage: false },
    });
    expect(levels).toMatchObject({ useLogFirstStage: false });
  });

  it("defaults the first stage off for WLS without reporting an adjustment (#575)", () => {
    const { parameters, adjustments } = resolveOk({
      dataShape: THREE_COLUMN,
      parameters: { modelType: "WLS" },
      mode: "lenient",
    });
    expect(parameters).toMatchObject({ useLogFirstStage: false });
    expect(adjustments.map((adjustment) => adjustment.param)).not.toContain(
      "useLogFirstStage",
    );
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

    it("keeps the log first stage on WAIVE when lenient mode turns instrumenting back on", () => {
      const resolved = resolveOk({
        parameters: { modelType: "WAIVE", shouldUseInstrumenting: false },
        mode: "lenient",
      });
      expect(resolved.parameters).toMatchObject({
        modelType: "WAIVE",
        shouldUseInstrumenting: true,
        useLogFirstStage: true,
      });
      expect(resolved.adjustments).toContainEqual(
        expect.objectContaining({
          param: "shouldUseInstrumenting",
          from: false,
          to: true,
        }),
      );
      expect(resolved.adjustments.map((a) => a.param)).not.toContain(
        "useLogFirstStage",
      );
    });

    it("does not report a first-stage change when lenient mode turns instrumenting off on WLS", () => {
      const resolved = resolveOk({
        parameters: { modelType: "WLS", shouldUseInstrumenting: true },
        mode: "lenient",
      });
      expect(resolved.parameters).toMatchObject({
        modelType: "WLS",
        shouldUseInstrumenting: false,
        useLogFirstStage: false,
      });
      expect(resolved.adjustments.map((a) => a.param)).not.toContain(
        "useLogFirstStage",
      );
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
        topLevelKeys: Object.keys({
          data: [],
          parameters: parityCase.parameters,
          ...(parityCase.topLevel ?? {}),
        }),
        acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
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

  it("leaves the page's log-first-stage choice out of a WLS submission (#575)", () => {
    // The option is hidden for WLS and the page keeps the default (true) in
    // its state; the resolver must neither see it as a conflict nor report
    // an adjustment that would overwrite the choice for the next MAIVE run.
    const wls: ModelParameters = {
      ...CONFIG.DEFAULT_MODEL_PARAMETERS,
      modelType: "WLS",
      shouldUseInstrumenting: false,
      weight: "standard_weights",
      useLogFirstStage: true,
    };
    const submitted = fromPageParameters(wls);
    expect(submitted).not.toHaveProperty("useLogFirstStage");
    const { parameters, adjustments } = resolveOk({
      dataShape: THREE_COLUMN,
      parameters: submitted,
      mode: "lenient",
    });
    expect(parameters).toMatchObject({
      modelType: "WLS",
      useLogFirstStage: false,
    });
    expect(adjustments).toEqual([]);
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

describe("RDT (#559)", () => {
  it("resolves to a bare { modelType: 'RDT' } in the browser", () => {
    const resolved = resolveOk({
      dataShape: FOUR_COLUMN,
      parameters: { modelType: "RDT" },
      mode: "lenient",
    });
    expect(resolved.modelType).toBe("RDT");
    expect(resolved.parameters).toEqual({ modelType: "RDT" });
    expect(resolved.recipe).toBeNull();
    expect(resolved.adjustments).toEqual([]);
  });

  it("falls back to RTMA on a two-column upload like every model that needs n_obs", () => {
    const resolved = resolveOk({
      dataShape: TWO_COLUMN,
      parameters: { modelType: "RDT" },
      mode: "lenient",
    });
    expect(resolved.modelType).toBe("RTMA");
    expect(resolved.adjustments.map((a) => a.param)).toEqual(["modelType"]);
  });

  it("is not a public model type in strict mode", () => {
    expect(
      resolveError({
        dataShape: FOUR_COLUMN,
        parameters: { modelType: "RDT" },
      }),
    ).toMatch(/Must be one of: MAIVE, WAIVE, WLS, RTMA\./);
  });

  it("widens to the page shape with instrumenting and AR off, and narrows back to the model type alone", () => {
    const page = toPageParameters({ modelType: "RDT" });
    expect(page).toMatchObject({
      ...CONFIG.DEFAULT_MODEL_PARAMETERS,
      modelType: "RDT",
      shouldUseInstrumenting: false,
      computeAndersonRubin: false,
    });
    expect(fromPageParameters(page)).toEqual({ modelType: "RDT" });
  });

  it("does not match any recipe", () => {
    expect(detectRecipe({ modelType: "RDT" })).toBeNull();
  });
});

describe("top-level request body keys (#574)", () => {
  // The trap: on /v1/run-model a `modelType` beside `data` used to be
  // ignored and MAIVE ran with a 200. Now the strict resolver names the key
  // and says where it belongs.
  it("rejects a parameter name at the top level of a sync request, naming it and where it belongs", () => {
    expect(
      resolveError({
        dataShape: THREE_COLUMN,
        family: "maive",
        topLevelKeys: ["modelType", "data"],
        acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
      }),
    ).toBe(
      "Unexpected top-level key: modelType. modelType is a run parameter and belongs inside `parameters`; this endpoint accepts data, parameters and recipe at the top level.",
    );
  });

  it("names every misplaced key at once", () => {
    expect(
      resolveError({
        dataShape: THREE_COLUMN,
        family: "maive",
        topLevelKeys: ["data", "modelType", "maiveMethod"],
        acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
      }),
    ).toMatch(
      /^Unexpected top-level keys: modelType, maiveMethod\. modelType and maiveMethod are run parameters and belong inside `parameters`/,
    );
  });

  it("rejects every known parameter name at the top level of a sync request", () => {
    const parameterNames = [
      "modelType",
      "maiveMethod",
      "weight",
      "standardErrorTreatment",
      "includeStudyDummies",
      "includeStudyClustering",
      "computeAndersonRubin",
      "useLogFirstStage",
      "winsorize",
      "shouldUseInstrumenting",
      "favorPositive",
      "alphaSelect",
      "ciLevel",
      "seed",
    ];
    parameterNames.forEach((name) => {
      expect(
        resolveError({
          dataShape: THREE_COLUMN,
          family: "maive",
          topLevelKeys: ["data", name],
          acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
        }),
      ).toContain(
        `Unexpected top-level key: ${name}. ${name} is a run parameter and belongs inside \`parameters\``,
      );
    });
  });

  it("rejects an arbitrary unknown top-level key as well", () => {
    expect(
      resolveError({
        dataShape: THREE_COLUMN,
        family: "maive",
        topLevelKeys: ["data", "options"],
        acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
      }),
    ).toBe(
      "Unexpected top-level key: options. Only data, parameters and recipe are accepted at the top level.",
    );
  });

  it("checks the top level before the parameters, so the misplaced key is what gets reported", () => {
    expect(
      resolveError({
        dataShape: THREE_COLUMN,
        family: "maive",
        parameters: { favourPositive: true },
        topLevelKeys: ["data", "parameters", "modelType"],
        acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
      }),
    ).toMatch(/^Unexpected top-level key: modelType/);
  });

  it("accepts the documented sync keys", () => {
    const { parameters } = resolveOk({
      dataShape: THREE_COLUMN,
      family: "maive",
      recipe: "EK",
      topLevelKeys: ["recipe", "data", "parameters"],
      acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
    });
    expect(parameters.modelType).toBe("WLS");
  });

  it("keeps the async form, where a top-level modelType is documented, and still rejects other parameter names there", () => {
    const { parameters } = resolveOk({
      dataShape: THREE_COLUMN,
      modelType: "WLS",
      topLevelKeys: ["data", "modelType"],
      acceptedTopLevelKeys: V1_ASYNC_TOP_LEVEL_KEYS,
    });
    expect(parameters.modelType).toBe("WLS");
    expect(
      resolveError({
        dataShape: THREE_COLUMN,
        modelType: "WLS",
        topLevelKeys: ["data", "modelType", "weight"],
        acceptedTopLevelKeys: V1_ASYNC_TOP_LEVEL_KEYS,
      }),
    ).toBe(
      "Unexpected top-level key: weight. weight is a run parameter and belongs inside `parameters`; this endpoint accepts data, parameters, recipe and modelType at the top level.",
    );
  });

  it("does not apply in lenient mode, which never sees a request body", () => {
    const { parameters } = resolveOk({
      dataShape: THREE_COLUMN,
      mode: "lenient",
      topLevelKeys: ["modelType", "whatever"],
      acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
    });
    expect(parameters.modelType).toBe("MAIVE");
  });
});
