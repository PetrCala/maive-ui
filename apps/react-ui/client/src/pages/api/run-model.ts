import type { NextApiRequest, NextApiResponse } from "next";
import { modelService } from "@api/services/modelService";
import type { DataArray, ModelParameters, ModelResponse } from "@src/types";
import { cleanCliErrorMessage } from "@src/utils/errorMessageUtils";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { data, parameters } = req.body as {
      data: DataArray;
      parameters: ModelParameters;
    };

    // Validate required fields
    if (!data || !parameters) {
      return res.status(400).json({
        error: "Missing required fields: data and parameters are required",
      });
    }

    // Call the R backend directly via server-side service
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: ModelResponse = await modelService.runModel(data, parameters);

    // Return the result
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Error in run-model API route:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to run model",
      message: cleanCliErrorMessage(errorMessage),
    });
  }
}
