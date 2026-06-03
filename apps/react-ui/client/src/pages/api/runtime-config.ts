import type { NextApiRequest, NextApiResponse } from "next";

// Served at request time (not written to disk at startup) so the app can run
// on a read-only filesystem, e.g. AWS Lambda where only /tmp is writable.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const rApiUrl =
    process.env.NEXT_PUBLIC_R_API_URL ?? process.env.R_API_URL ?? "";

  const body = `window.RUNTIME_CONFIG = ${JSON.stringify({ R_API_URL: rApiUrl })};\n`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
}
