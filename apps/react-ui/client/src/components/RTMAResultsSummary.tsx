"use client";

import type { RTMAResults } from "@src/types/api";
import Alert from "@components/Alert";
import Tooltip from "@components/Tooltip";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import {
  getRtmaDiagnosticWarnings,
  isRtmaModeUnreliable,
} from "@utils/rtmaDiagnostics";

type RTMAResultsSummaryProps = {
  results: RTMAResults;
  showTooltips?: boolean;
  // See the same prop on ResultsSummary: the default two-column split keys off
  // the viewport, so pass 1 when the component itself is rendered narrow.
  columns?: 1 | 2;
};

const formatNumber = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(3) : String(value);

const formatCI = (ci: [number, number]): string =>
  `[${formatNumber(ci[0])}, ${formatNumber(ci[1])}]`;

const formatPercentage = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

type Metric = {
  label: string;
  value: string;
  subValue?: string;
  tooltip: string;
};

export default function RTMAResultsSummary({
  results,
  showTooltips = false,
  columns = 2,
}: RTMAResultsSummaryProps) {
  // The backend echoes the level of the equal-tailed credible intervals; runs
  // stored before it did were always fitted at the UI's fixed 0.95.
  const ciPercent = Math.round((results.ciLevel ?? 0.95) * 100);
  const intervalNote = `The interval is the equal-tailed ${ciPercent}% credible interval (posterior quantiles; phacking does not compute HPD intervals).`;

  // Both modes below come from an mle_params() optimisation that runs
  // separately from the sampler. When it fails, those two numbers are the only
  // part of the result it damaged, so they are withheld rather than shown next
  // to intervals that are still sound (#480).
  const modeUnreliable = isRtmaModeUnreliable(results);
  const withheldModeNote = (mode: number, median?: number): string =>
    `mode ${formatNumber(mode)} withheld: its optimisation did not converge${
      median != null ? `; posterior median ${formatNumber(median)}` : ""
    }`;
  const withheldModeTooltip = `The optimisation that produces the mode did not converge for this run, so only the interval is shown. ${intervalNote}`;

  const metrics: Metric[] = [
    {
      label: "Corrected Effect (μ)",
      value: modeUnreliable
        ? formatCI(results.muCI)
        : `${formatNumber(results.mu)} ${formatCI(results.muCI)}`,
      subValue: modeUnreliable
        ? withheldModeNote(results.mu, results.muMedian)
        : results.muMedian != null
          ? `median ${formatNumber(results.muMedian)}`
          : undefined,
      tooltip: modeUnreliable
        ? withheldModeTooltip
        : `Posterior mode of the bias-corrected mean effect from the right-truncated meta-analysis. ${intervalNote} The posterior can be skewed, so the median is shown alongside the mode.`,
    },
    ...(results.unadjustedMean != null
      ? [
          {
            label: "Unadjusted Mean",
            value: formatNumber(results.unadjustedMean),
            tooltip:
              "Naive inverse-variance (fixed-effect) pooled mean of the analyzed estimates, with no correction applied. Compare it with the corrected effect to see the direction and size of the RTMA correction; the correction can move the estimate in either direction.",
          },
        ]
      : []),
    {
      label: "Heterogeneity (τ)",
      value: modeUnreliable
        ? formatCI(results.tauCI)
        : `${formatNumber(results.tau)} ${formatCI(results.tauCI)}`,
      subValue: modeUnreliable
        ? withheldModeNote(results.tau, results.tauMedian)
        : results.tauMedian != null
          ? `median ${formatNumber(results.tauMedian)}`
          : undefined,
      tooltip: modeUnreliable
        ? withheldModeTooltip
        : `Posterior mode of the between-study standard deviation (heterogeneity). ${intervalNote}`,
    },
    {
      label: "Not Affirmative Estimates",
      value: `${results.nonaffirmativeCount} (${formatPercentage(results.nonaffirmativeProportion)})`,
      tooltip:
        "Estimates that are not statistically significant in the favored direction at the selection threshold. This is not the same as non-significant: an estimate significant in the opposite direction also counts as not affirmative. RTMA fits its model to these estimates to correct for p-hacking.",
    },
    ...(results.k != null
      ? [
          {
            label: "Estimates Used (k)",
            value: String(results.k),
            subValue:
              results.affirmativeCount != null
                ? `${results.affirmativeCount} affirmative`
                : undefined,
            tooltip:
              "Number of estimates the model was fitted to, after removing rows with a missing or non-positive standard error. Affirmative estimates are significant in the favored direction at the selection threshold.",
          },
        ]
      : []),
  ];

  // Conditions the backend raised while fitting, followed by the ones derived
  // from the diagnostics it reported. Diagnostic warnings come second because
  // a wrong favored direction (the usual backend warning) invalidates the run
  // outright, whereas these qualify numbers that are otherwise meaningful.
  const warnings = [
    ...(results.warnings ?? []),
    ...getRtmaDiagnosticWarnings(results),
  ];
  const droppedRows = results.droppedRows ?? 0;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">RTMA Results</h2>
      {warnings.length > 0 ? (
        <div className="mb-4 space-y-2">
          {warnings.map((warning) => (
            <Alert
              key={warning}
              message={warning}
              type={CONST.ALERT_TYPES.WARNING}
            />
          ))}
        </div>
      ) : null}
      {droppedRows > 0 ? (
        <div className="mb-4">
          <Alert
            message={`${droppedRows} uploaded ${droppedRows === 1 ? "row was" : "rows were"} dropped before fitting because of a missing or non-positive standard error.`}
            type={CONST.ALERT_TYPES.INFO}
          />
        </div>
      ) : null}
      <div
        className={
          columns === 1
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
        }
      >
        {metrics.map((metric) => {
          const content = (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {metric.label}
              </p>
              <p className="text-lg font-medium">{metric.value}</p>
              {metric.subValue ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {metric.subValue}
                </p>
              ) : null}
            </div>
          );

          if (showTooltips) {
            return (
              <Tooltip
                key={metric.label}
                content={metric.tooltip}
                visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
              >
                {content}
              </Tooltip>
            );
          }

          return <div key={metric.label}>{content}</div>;
        })}
      </div>
    </div>
  );
}
