import type { NextApiRequest, NextApiResponse } from "next";
import { proxyModelRun } from "@api/server/rBackendProxy";

// Same-origin proxy for synchronous RDT runs (#559), on the pattern of
// /api/run-rtma: the browser posts here and the server signs and forwards to
// the IAM-protected R backend. RDT is experimental and has no public /v1
// route; this is its only entry point besides the async queue.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  return proxyModelRun(req, res, "/run-rdt");
}
