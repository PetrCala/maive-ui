"use client";

import type { RTMAResults } from "@src/types/api";
import Tooltip from "@components/Tooltip";
import CONFIG from "@src/CONFIG";

type RTMAResultsSummaryProps = {
  results: RTMAResults;
  showTooltips?: boolean;
};

const formatNumber = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(3) : String(value);

const formatCI = (ci: [number, number]): string =>
  `[${formatNumber(ci[0])}, ${formatNumber(ci[1])}]`;

const formatPercentage = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

export default function RTMAResultsSummary({
  results,
  showTooltips = false,
}: RTMAResultsSummaryProps) {
  const metrics = [
    {
      label: "Corrected Effect (μ)",
      value: `${formatNumber(results.mu)} ${formatCI(results.muCI)}`,
      tooltip:
        "Posterior mode of the bias-corrected mean effect from the right-truncated meta-analysis. The interval is the highest-posterior-density credible interval.",
    },
    {
      label: "Heterogeneity (τ)",
      value: `${formatNumber(results.tau)} ${formatCI(results.tauCI)}`,
      tooltip:
        "Posterior mode of the between-study standard deviation (heterogeneity). The interval is the highest-posterior-density credible interval.",
    },
    {
      label: "Non-significant Estimates",
      value: `${results.nonaffirmativeCount} (${formatPercentage(results.nonaffirmativeProportion)})`,
      tooltip:
        "Number and proportion of estimates that are not statistically significant at the selection threshold (nonaffirmative). RTMA uses these estimates to identify and correct for p-hacking.",
    },
  ];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">RTMA Results</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric) => {
          const content = (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {metric.label}
              </p>
              <p className="text-lg font-medium">{metric.value}</p>
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
