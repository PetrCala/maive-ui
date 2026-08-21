// Cost circuit breaker.
//
// When the R backend has been throttling continuously (its reserved-concurrency
// cap saturated by abnormal load), or the daily compute budget or hourly error
// threshold is crossed, a CloudWatch alarm publishes to SNS, which invokes this
// handler. It degrades rather than kills: it lowers the reserved concurrency of
// each protected function to DEGRADED_CONCURRENCY (never 0, so the service
// stays usable at a bounded spend rate) and flips the unstable-banner SSM
// parameters so the UI tells users the service is running with reduced
// capacity.
//
// Recovery is deliberate, never automatic: once the load has been dealt with
// (for example blocked at the edge), an operator restores the cap with
// `terraform apply` (which resets reserved concurrency to the configured
// value) and turns the banner back off. See docs/COST_CONTROLS.md.
//
// No bundling: @aws-sdk/client-lambda and @aws-sdk/client-ssm ship in the
// nodejs20.x runtime.

import {
  LambdaClient,
  PutFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";
import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

const lambdaClient = new LambdaClient({});
const ssmClient = new SSMClient({});

const DEFAULT_DEGRADED_CONCURRENCY = 2;

// Degraded floor for reserved concurrency. Never 0: the point is to bound the
// spend rate while keeping the service alive, not to shut it off.
const degradedConcurrency = () => {
  const parsed = Number.parseInt(process.env.DEGRADED_CONCURRENCY ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1
    ? parsed
    : DEFAULT_DEGRADED_CONCURRENCY;
};

const flipBanner = async () => {
  const enabledParameter = process.env.BANNER_ENABLED_PARAMETER_NAME;
  const messageParameter = process.env.BANNER_MESSAGE_PARAMETER_NAME;
  if (!enabledParameter) {
    return false;
  }

  await ssmClient.send(
    new PutParameterCommand({
      Name: enabledParameter,
      Type: "String",
      Value: "true",
      Overwrite: true,
    }),
  );

  const message = process.env.BANNER_MESSAGE;
  if (messageParameter && message) {
    await ssmClient.send(
      new PutParameterCommand({
        Name: messageParameter,
        Type: "String",
        Value: message,
        Overwrite: true,
      }),
    );
  }

  console.log("Circuit breaker tripped: enabled the unstable banner");
  return true;
};

export const handler = async () => {
  const targets = (process.env.PROTECTED_FUNCTIONS || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const concurrency = degradedConcurrency();

  const degraded = [];
  const errors = [];
  for (const functionName of targets) {
    // Sequential on purpose: at most a couple of functions, and a failure on
    // one should not prevent the attempt on the next.
    try {
      // eslint-disable-next-line no-await-in-loop
      await lambdaClient.send(
        new PutFunctionConcurrencyCommand({
          FunctionName: functionName,
          ReservedConcurrentExecutions: concurrency,
        }),
      );
      console.log(
        `Circuit breaker tripped: set reserved concurrency to ${concurrency} for ${functionName}`,
      );
      degraded.push(functionName);
    } catch (error) {
      console.error(
        `Failed to set reserved concurrency for ${functionName}`,
        error,
      );
      errors.push(`concurrency:${functionName}`);
    }
  }

  let bannerEnabled = false;
  try {
    bannerEnabled = await flipBanner();
  } catch (error) {
    console.error("Failed to enable the unstable banner", error);
    errors.push("banner");
  }

  if (errors.length > 0) {
    // Throw so the failure is visible in metrics and SNS retries the delivery;
    // every action above is idempotent, so a retry is safe.
    throw new Error(`Circuit breaker partially failed: ${errors.join(", ")}`);
  }

  return { degraded, concurrency, bannerEnabled };
};
