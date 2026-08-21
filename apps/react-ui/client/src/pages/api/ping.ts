import type { NextApiRequest, NextApiResponse } from "next";
import { signedRFetch } from "@api/server/rBackendProxy";
import type { PingResponse } from "@src/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Signed server-side call: the R backend Function URL requires IAM auth.
    const upstream = await signedRFetch("/ping", {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      throw new Error(`R backend returned HTTP ${upstream.status}`);
    }
    const result = (await upstream.json()) as PingResponse;
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Error in ping API route:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to ping R service",
      message: errorMessage,
    });
  }
}
