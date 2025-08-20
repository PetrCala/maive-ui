import type { NextApiRequest, NextApiResponse } from "next";
import { modelService } from "@api/services/modelService";
import type { ModelResponse } from "@api/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { data, parameters } = req.body;

    // Validate required fields
    if (!data || !parameters) {
      return res.status(400).json({
        error: "Missing required fields: data and parameters are required",
      });
    }

    // Call the R backend directly via server-side service
    const result: ModelResponse = await modelService.runModel(data, parameters);

    // Return the result
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error in run-model API route:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      error: "Failed to run model",
      message: errorMessage,
    });
  }
}
