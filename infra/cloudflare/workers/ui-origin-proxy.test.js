// Node test for the redirect half of ui-origin-proxy (#571). Run with
//   npm test --prefix infra/cloudflare
// (no install needed; node 20+). The origin-proxy half needs Cloudflare's
// runtime and is not exercised here.
import assert from "node:assert/strict";
import { test } from "node:test";

import worker, { redirectTarget } from "./ui-origin-proxy.js";

test("apex and www of maive.eu redirect to easymeta.org, path and query preserved", () => {
  assert.equal(
    redirectTarget("https://maive.eu/api-docs?x=1"),
    "https://easymeta.org/api-docs?x=1",
  );
  assert.equal(
    redirectTarget("https://www.maive.eu/upload?a=1&b=two#frag"),
    "https://easymeta.org/upload?a=1&b=two",
  );
  assert.equal(redirectTarget("https://maive.eu/"), "https://easymeta.org/");
  assert.equal(redirectTarget("http://MAIVE.EU/x"), "https://easymeta.org/x");
});

test("api.maive.eu and the canonical hostnames are never redirected", () => {
  for (const url of [
    "https://api.maive.eu/v1/health",
    "https://api.maive.eu/openapi.yaml",
    "https://easymeta.org/",
    "https://www.easymeta.org/about",
    "https://foo.maive.eu/",
    "https://zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws/",
  ]) {
    assert.equal(redirectTarget(url), null, url);
  }
});

test("fetch() answers a retired hostname with a 301 and a Location header", async () => {
  const response = await worker.fetch(
    new Request("https://www.maive.eu/results?run=abc"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://easymeta.org/results?run=abc",
  );
});
