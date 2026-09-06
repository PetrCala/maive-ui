// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";
import type { MockResponse } from "@tests/helpers/nextApiMocks";
import {
  buildAgentMd,
  buildLlmsTxt,
  recipeCurlExample,
  EXAMPLE_RTMA_ROWS,
} from "@src/lib/discovery";
import { RECIPE_NAMES } from "@src/lib/parameterResolver";
import { getCitationsForModel } from "@src/utils/citationUtils";
import CONST from "@src/CONST";
import llmsHandler from "@src/pages/api/discovery/llms-txt";
import agentHandler from "@src/pages/api/discovery/agent-md";

const withSend = <T>(res: MockResponse<T>): MockResponse<T> => {
  res.send = ((body: T) => {
    res.body = body;
    return res;
  }) as MockResponse<T>["send"];
  return res;
};

const CLIENT_ROOT = path.resolve(__dirname, "../..");

describe("discovery files (#555)", () => {
  const llms = buildLlmsTxt();
  const agent = buildAgentMd();

  it("point at the spec, the docs page and each other", () => {
    for (const text of [llms, agent]) {
      expect(text).toContain(CONST.LINKS.PUBLIC_API.SPEC_URL);
      expect(text).toContain(
        `${CONST.LINKS.APP.WEBSITE}${CONST.LINKS.PUBLIC_API.DOCS_ROUTE}`,
      );
    }
    expect(llms).toContain(CONST.LINKS.DISCOVERY.AGENT_MD);
  });

  it("list the four recipes with curl examples from the recipe table", () => {
    for (const name of RECIPE_NAMES) {
      expect(llms).toContain(`- ${name}:`);
      expect(agent).toContain(`### ${name}`);
      expect(agent).toContain(recipeCurlExample(name));
    }
    expect(recipeCurlExample("RTMA")).toContain("/v1/run-rtma");
    expect(recipeCurlExample("EK")).toContain('"recipe": "EK"');
  });

  it("show an RTMA example the API would actually accept", () => {
    // Every estimate affirmative (|t| >= 1.96) is refused outright, and a
    // mostly-affirmative dataset samples badly (#565). Guard the constant
    // rather than posting to production, which would be slow and flaky.
    const nonaffirmative = EXAMPLE_RTMA_ROWS.filter(
      ({ effect, se }) => Math.abs(effect / se) < 1.96,
    );
    expect(nonaffirmative.length).toBeGreaterThan(0);
    expect(nonaffirmative.length * 2).toBeGreaterThanOrEqual(
      EXAMPLE_RTMA_ROWS.length,
    );
    expect(EXAMPLE_RTMA_ROWS.length).toBeGreaterThanOrEqual(40);
    expect(recipeCurlExample("RTMA")).toContain('{"effect":0.05,"se":0.1}');
  });

  it("describe the resolved echo and the unknown-key rejection", () => {
    expect(agent).toContain("resolvedParameters");
    expect(agent).toContain("favourPositive");
    expect(agent).toContain("400");
    expect(llms).toContain("resolvedParameters");
  });

  it("cite from the registry, never by hand", () => {
    const maive = getCitationsForModel("MAIVE")[0].formats.plain;
    const [rtmaMethod, rtmaSoftware] = getCitationsForModel("RTMA");
    for (const text of [llms, agent]) {
      expect(text).toContain(maive);
      expect(text).toContain(rtmaMethod.formats.plain);
      expect(text).toContain(rtmaSoftware.formats.plain);
      expect(text).toContain(CONST.LINKS.APP.WEBSITE);
    }
  });

  it("contain no dashes of the typographic kind", () => {
    for (const text of [llms, agent]) {
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("are served with text content types", () => {
    const llmsRes = withSend(createMockRes<string>());
    llmsHandler(createMockReq({ method: "GET" }), llmsRes);
    expect(llmsRes.statusCode).toBe(200);
    expect(llmsRes.headers["Content-Type"]).toContain("text/plain");
    expect(llmsRes.body).toBe(llms);

    const agentRes = withSend(createMockRes<string>());
    agentHandler(createMockReq({ method: "GET" }), agentRes);
    expect(agentRes.statusCode).toBe(200);
    expect(agentRes.headers["Content-Type"]).toContain("text/markdown");
    expect(agentRes.body).toBe(agent);

    const rejected = withSend(createMockRes<string>());
    llmsHandler(createMockReq({ method: "POST" }), rejected);
    expect(rejected.statusCode).toBe(405);
  });

  it("are rewritten from the site root", () => {
    const config = readFileSync(
      path.join(CLIENT_ROOT, "next.config.js"),
      "utf8",
    );
    expect(config).toContain('source: "/llms.txt"');
    expect(config).toContain('source: "/agent.md"');
  });

  it("are referenced from robots.txt", () => {
    const robots = readFileSync(
      path.join(CLIENT_ROOT, "public/robots.txt"),
      "utf8",
    );
    expect(robots).toContain(CONST.LINKS.DISCOVERY.LLMS_TXT);
  });
});

describe("public/openapi.yaml", () => {
  it("is a byte-for-byte copy of docs/api/openapi.yaml", () => {
    // The spec is served from the app (and via the API host worker) as a
    // static file; the Docker build context is apps/react-ui, so the file
    // has to live under public/. When this fails, run:
    //   cp docs/api/openapi.yaml apps/react-ui/client/public/openapi.yaml
    const canonical = readFileSync(
      path.resolve(CLIENT_ROOT, "../../../docs/api/openapi.yaml"),
      "utf8",
    );
    const served = readFileSync(
      path.join(CLIENT_ROOT, "public/openapi.yaml"),
      "utf8",
    );
    expect(served).toBe(canonical);
  });

  it("documents the resolved echo and the recipe field", () => {
    const spec = readFileSync(
      path.join(CLIENT_ROOT, "public/openapi.yaml"),
      "utf8",
    );
    expect(spec).toContain("ResolvedRunEcho");
    expect(spec).toContain("resolvedParameters");
    expect(spec).toContain("enum: [MAIVE, RTMA, PET-PEESE, EK]");
    expect(spec).toContain(CONST.LINKS.PUBLIC_API.SPEC_URL);
  });
});
