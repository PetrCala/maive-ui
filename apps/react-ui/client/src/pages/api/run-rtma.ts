import type { NextApiRequest, NextApiResponse } from "next";
import { proxyModelRun } from "@api/server/rBackendProxy";

// Same-origin proxy for synchronous RTMA runs (#530): the R backend Function
// URL requires IAM auth, so the browser posts here and the server signs and
// forwards. The internal contract (JSON-string data/parameters, HTTP 200 with
// { data } or { error, message }) passes through untouched.
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
  return proxyModelRun(req, res, "/run-rtma");
}
