import type { NextApiRequest, NextApiResponse } from "next";
import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

type StatusBannerResponse = {
  show: boolean;
  message: string;
};

const enabledParameterName = process.env.STATUS_BANNER_ENABLED_PARAMETER_NAME;
const messageParameterName = process.env.STATUS_BANNER_MESSAGE_PARAMETER_NAME;
const bannerRegion =
  process.env.STATUS_BANNER_AWS_REGION ??
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION;
const defaultBannerMessage =
  "The current release may be unstable. Please proceed with caution.";
const forceEnabled = process.env.STATUS_BANNER_FORCE_ENABLED === "true";
const forceMessage = process.env.STATUS_BANNER_FORCE_MESSAGE?.trim();

let ssmClient: SSMClient | undefined;

const getSsmClient = () => {
  if (!bannerRegion) {
    return undefined;
  }

  if (!ssmClient) {
    ssmClient = new SSMClient({ region: bannerRegion });
  }

  return ssmClient;
};

const defaultResponse: StatusBannerResponse = {
  show: false,
  message: "",
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<StatusBannerResponse>,
) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json(defaultResponse);
  }

  if (forceEnabled) {
    return res.status(200).json({
      show: true,
      message: forceMessage ?? defaultBannerMessage,
    });
  }

  if (!enabledParameterName || !messageParameterName) {
    return res.status(200).json(defaultResponse);
  }

  const client = getSsmClient();

  if (!client) {
    return res.status(200).json(defaultResponse);
  }

  try {
    const command = new GetParametersCommand({
      Names: [enabledParameterName, messageParameterName],
      WithDecryption: true,
    });

    const { Parameters } = await client.send(command);

    const namedParameters = (Parameters ?? []).filter(
      (param): param is { Name: string; Value?: string } =>
        typeof param.Name === "string",
    );

    const values = new Map(
      namedParameters.map((param) => [param.Name, param.Value ?? ""]),
    );

    const isEnabled =
      (values.get(enabledParameterName)?.toLowerCase() ?? "") === "true";
    const message =
      values.get(messageParameterName)?.trim() ?? defaultBannerMessage;

    return res.status(200).json({
      show: isEnabled,
      message: isEnabled ? message : defaultBannerMessage,
    });
  } catch (error) {
    console.error("Failed to load status banner parameters", error);
    return res.status(200).json(defaultResponse);
  }
};

export default handler;
