// Cost circuit breaker.
//
// When the R backend has been throttling continuously (its reserved-concurrency
// cap saturated by abnormal load), a CloudWatch alarm publishes to SNS, which
// invokes this handler. It sets the reserved concurrency of each protected
// function to 0, which makes every further invocation throttle (HTTP 429) and
// halts compute spend.
//
// Recovery is deliberate, never automatic: once the load has been dealt with
// (for example blocked at the edge), an operator restores the cap with
// `terraform apply` (which resets reserved concurrency to the configured
// value) or from the Lambda console. See docs/COST_CONTROLS.md.
//
// No bundling: @aws-sdk/client-lambda ships in the nodejs20.x runtime.

import {
  LambdaClient,
  PutFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";

const client = new LambdaClient({});

export const handler = async () => {
  const targets = (process.env.PROTECTED_FUNCTIONS || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const stopped = [];
  for (const functionName of targets) {
    // Sequential on purpose: at most a couple of functions, and a failure on
    // one should not prevent the attempt on the next.
    // eslint-disable-next-line no-await-in-loop
    await client.send(
      new PutFunctionConcurrencyCommand({
        FunctionName: functionName,
        ReservedConcurrentExecutions: 0,
      }),
    );
    console.log(
      `Circuit breaker tripped: set reserved concurrency to 0 for ${functionName}`,
    );
    stopped.push(functionName);
  }

  return { stopped };
};
