import type { NextApiRequest, NextApiResponse } from "next";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { GetRunResponse, RunStatus } from "@src/types/api";

const region =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? undefined;
const tableName = process.env.RUNS_TABLE_NAME;

let ddbDocClient: DynamoDBDocumentClient | undefined;

const getDdbDocClient = () => {
  if (!region) {
    return undefined;
  }
  if (!ddbDocClient) {
    ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return ddbDocClient;
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<GetRunResponse | { error: string }>,
) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!tableName) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  const ddb = getDdbDocClient();
  if (!ddb) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  const { jobId } = req.query;
  const id = Array.isArray(jobId) ? jobId[0] : jobId;
  if (!id) {
    return res.status(400).json({ error: "Missing jobId." });
  }

  try {
    // Single GetItem with a projection. While the run is non-terminal the
    // `result` attribute doesn't exist yet (cheap read); the client stops
    // polling on a terminal status, so the heavy result is read exactly once.
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { jobId: id },
        ProjectionExpression:
          "jobId, #status, modelType, #result, errorMessage, runDurationMs, submittedAt",
        ExpressionAttributeNames: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "#status": "status",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "#result": "result",
        },
      }),
    );

    if (!Item) {
      return res.status(404).json({ error: "Run not found or expired." });
    }

    const status = Item.status as RunStatus;
    const body: GetRunResponse = {
      jobId: id,
      status,
      modelType: Item.modelType as GetRunResponse["modelType"],
    };
    if (Item.result) {
      body.result = Item.result as string;
    }
    if (Item.errorMessage) {
      body.errorMessage = Item.errorMessage as string;
    }
    if (typeof Item.runDurationMs === "number") {
      body.runDurationMs = Item.runDurationMs;
    }
    if (typeof Item.submittedAt === "number") {
      body.runTimestamp = new Date(Item.submittedAt).toISOString();
    }

    return res.status(200).json(body);
  } catch (error) {
    console.error("Failed to fetch run", error);
    return res.status(500).json({ error: "Failed to fetch run." });
  }
};

export default handler;
