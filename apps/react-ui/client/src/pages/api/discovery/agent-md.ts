import type { NextApiRequest, NextApiResponse } from "next";
import { buildAgentMd } from "@src/lib/discovery";

// Serves /agent.md (rewritten here by next.config.js). Rendered from the
// recipe table and citation registry so it cannot drift from the app (#555).
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method Not Allowed");
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(buildAgentMd());
}
