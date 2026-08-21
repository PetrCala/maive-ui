// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RUNNING_FRESH_MS,
  TIMEOUT_REUSE_MS,
  classifyDedup,
  computeInputHash,
  countRowsFromJson,
  methodFromParameters,
  stableStringify,
  type RunRecord,
} from "@api/server/runRecords";

const baseRecord = (overrides: Partial<RunRecord>): RunRecord => ({
  jobId: "input#abc",
  inputHash: "abc",
  endpoint: "/run-model",
  status: "running",
  ...overrides,
});

describe("computeInputHash", () => {
  const data = JSON.stringify([{ effect: 1, se: 0.1 }]);

  it("is stable across parameter key order", () => {
    const a = computeInputHash("/run-model", data, {
      maiveMethod: "PET-PEESE",
      modelType: "MAIVE",
    });
    const b = computeInputHash("/run-model", data, {
      modelType: "MAIVE",
      maiveMethod: "PET-PEESE",
    });
    expect(a).toBe(b);
  });

  it("ignores the injected timeoutSeconds budget", () => {
    const withBudget = computeInputHash("/run-model", data, {
      maiveMethod: "PET-PEESE",
      timeoutSeconds: 570,
    });
    const withoutBudget = computeInputHash("/run-model", data, {
      maiveMethod: "PET-PEESE",
    });
    expect(withBudget).toBe(withoutBudget);
  });

  it("hashes object and JSON-string parameters identically", () => {
    const asObject = computeInputHash("/run-model", data, {
      maiveMethod: "EK",
    });
    const asString = computeInputHash(
      "/run-model",
      data,
      JSON.stringify({ maiveMethod: "EK" }),
    );
    expect(asObject).toBe(asString);
  });

  it("differs across endpoints, datasets and parameters", () => {
    const reference = computeInputHash("/run-model", data, {
      maiveMethod: "EK",
    });
    expect(computeInputHash("/run-rtma", data, { maiveMethod: "EK" })).not.toBe(
      reference,
    );
    expect(
      computeInputHash("/run-model", `${data} `, { maiveMethod: "EK" }),
    ).not.toBe(reference);
    expect(
      computeInputHash("/run-model", data, { maiveMethod: "PET" }),
    ).not.toBe(reference);
  });
});

describe("stableStringify", () => {
  it("sorts keys at every nesting level", () => {
    expect(stableStringify({ b: { d: 1, c: 2 }, a: [3, { f: 4, e: 5 }] })).toBe(
      '{"a":[3,{"e":5,"f":4}],"b":{"c":2,"d":1}}',
    );
  });
});

describe("classifyDedup", () => {
  const now = 1_700_000_000_000;

  it("dedups a fresh running record", () => {
    const decision = classifyDedup(
      baseRecord({ status: "running", startedAt: now - 60_000 }),
      now,
    );
    expect(decision).toEqual({ kind: "running" });
  });

  it("ignores a stale running record (dead writer)", () => {
    const decision = classifyDedup(
      baseRecord({
        status: "running",
        startedAt: now - RUNNING_FRESH_MS - 1,
      }),
      now,
    );
    expect(decision).toBeUndefined();
  });

  it("replays a recent timeout with its recorded error", () => {
    const decision = classifyDedup(
      baseRecord({
        status: "timedout",
        finishedAt: now - 60_000,
        errorMessage: "The analysis timed out after 570 seconds.",
        errorCode: "timeout",
      }),
      now,
    );
    expect(decision).toEqual({
      kind: "timedout",
      errorMessage: "The analysis timed out after 570 seconds.",
      errorCode: "timeout",
    });
  });

  it("ignores a timeout older than the reuse window", () => {
    const decision = classifyDedup(
      baseRecord({
        status: "timedout",
        finishedAt: now - TIMEOUT_REUSE_MS - 1,
      }),
      now,
    );
    expect(decision).toBeUndefined();
  });

  it("never dedups succeeded or failed records", () => {
    expect(
      classifyDedup(
        baseRecord({ status: "succeeded", finishedAt: now - 1_000 }),
        now,
      ),
    ).toBeUndefined();
    expect(
      classifyDedup(
        baseRecord({ status: "failed", finishedAt: now - 1_000 }),
        now,
      ),
    ).toBeUndefined();
  });

  it("handles a missing record", () => {
    expect(classifyDedup(undefined, now)).toBeUndefined();
  });
});

describe("countRowsFromJson", () => {
  it("counts rows of a JSON-string dataset", () => {
    expect(countRowsFromJson(JSON.stringify([{ a: 1 }, { a: 2 }]))).toBe(2);
  });

  it("counts rows of an already-parsed array", () => {
    expect(countRowsFromJson([{ a: 1 }])).toBe(1);
  });

  it("degrades to undefined for non-tabular input", () => {
    expect(countRowsFromJson("not json")).toBeUndefined();
    expect(countRowsFromJson(JSON.stringify({ a: 1 }))).toBeUndefined();
    expect(countRowsFromJson(42)).toBeUndefined();
  });
});

describe("methodFromParameters", () => {
  it("reads maiveMethod from an object or JSON string", () => {
    expect(methodFromParameters({ maiveMethod: "PET" })).toBe("PET");
    expect(methodFromParameters(JSON.stringify({ maiveMethod: "EK" }))).toBe(
      "EK",
    );
  });

  it("degrades to undefined when absent or malformed", () => {
    expect(methodFromParameters({})).toBeUndefined();
    expect(methodFromParameters("not json")).toBeUndefined();
    expect(methodFromParameters(undefined)).toBeUndefined();
  });
});
