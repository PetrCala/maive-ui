import type { NextApiRequest, NextApiResponse } from "next";
import { pingService } from "@api/services/pingService";
import type { PingResponse } from "@api/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Call the ping service (this will now run server-side)
    const result: PingResponse = await pingService.ping();

    // Return the result
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error in ping API route:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      error: "Failed to ping service",
      message: errorMessage,
    });
  }
}
