import { describe, it, expect, vi, afterEach } from "vitest";
import { parseRunParameters } from "@src/utils/runParameterUtils";
import { isRdtResults, isRtmaResults } from "@src/utils/resultTypeUtils";
import type { ModelResults, RDTResults, RTMAResults } from "@src/types/api";
import CONFIG from "@src/CONFIG";

describe("parseRunParameters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to the defaults when there is nothing stored", () => {
    const parsed = parseRunParameters(null);
    expect(parsed.modelType).toBe(CONFIG.DEFAULT_MODEL_PARAMETERS.modelType);
    // Asserted as a literal rather than recomputed from the default, so the
    // test cannot agree with a broken derivation by making the same mistake.
    expect(parsed.shouldUseInstrumenting).toBe(true);
  });

  it("keeps stored values that are not derived", () => {
    const parsed = parseRunParameters(
      JSON.stringify({ modelType: "MAIVE", winsorize: 2 }),
    );
    expect(parsed.modelType).toBe("MAIVE");
    expect(parsed.winsorize).toBe(2);
  });

  it("reads a non-instrumented run back as WLS", () => {
    // This is how a WLS run is recorded: the model type in the stored object is
    // whatever was selected before instrumenting was switched off.
    const parsed = parseRunParameters(
      JSON.stringify({ modelType: "MAIVE", shouldUseInstrumenting: false }),
    );
    expect(parsed.modelType).toBe("WLS");
    expect(parsed.shouldUseInstrumenting).toBe(false);
  });

  it("leaves an RDT run labelled RDT when instrumenting is off (#559)", () => {
    // RDT records shouldUseInstrumenting: false like WLS does; without the
    // exclusion a stored RDT run came back labelled WLS and rendered as a
    // MAIVE estimate.
    const parsed = parseRunParameters(
      JSON.stringify({ modelType: "RDT", shouldUseInstrumenting: false }),
    );
    expect(parsed.modelType).toBe("RDT");
    expect(parsed.shouldUseInstrumenting).toBe(false);
    expect(
      parseRunParameters(
        JSON.stringify({ modelType: "RDT", shouldUseInstrumenting: true }),
      ).shouldUseInstrumenting,
    ).toBe(false);
  });

  it("leaves WAIVE and RTMA alone when instrumenting is off", () => {
    expect(
      parseRunParameters(
        JSON.stringify({ modelType: "WAIVE", shouldUseInstrumenting: false }),
      ).modelType,
    ).toBe("WAIVE");
    expect(
      parseRunParameters(
        JSON.stringify({ modelType: "RTMA", shouldUseInstrumenting: false }),
      ).modelType,
    ).toBe("RTMA");
  });

  it("derives the instrumenting flag rather than trusting it", () => {
    // A stored `true` on RTMA is incoherent; the model type wins.
    expect(
      parseRunParameters(
        JSON.stringify({ modelType: "RTMA", shouldUseInstrumenting: true }),
      ).shouldUseInstrumenting,
    ).toBe(false);
    expect(
      parseRunParameters(JSON.stringify({ modelType: "MAIVE" }))
        .shouldUseInstrumenting,
    ).toBe(true);
  });

  it("returns defaults instead of throwing on malformed JSON", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(parseRunParameters("{not json").modelType).toBe(
      CONFIG.DEFAULT_MODEL_PARAMETERS.modelType,
    );
  });
});

describe("isRtmaResults", () => {
  it("identifies each result shape by its own fields", () => {
    const rtma = { mu: 1, muCI: [0.5, 1.5] } as unknown as RTMAResults;
    const maive = {
      effectEstimate: 1,
      standardError: 0.1,
    } as unknown as ModelResults;

    expect(isRtmaResults(rtma)).toBe(true);
    expect(isRtmaResults(maive)).toBe(false);
  });
});

describe("isRdtResults", () => {
  it("identifies an RDT payload by its model field, and nothing else", () => {
    // RDT has neither muCI nor effectEstimate, so the shape tests above
    // cannot see it; the backend names the model instead (#559).
    const rdt = { model: "RDT", jump: -0.1 } as unknown as RDTResults;
    const rtma = { mu: 1, muCI: [0.5, 1.5] } as unknown as RTMAResults;
    const maive = { effectEstimate: 1 } as unknown as ModelResults;

    expect(isRdtResults(rdt)).toBe(true);
    expect(isRtmaResults(rdt)).toBe(false);
    expect(isRdtResults(rtma)).toBe(false);
    expect(isRdtResults(maive)).toBe(false);
  });
});
