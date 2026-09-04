"use client";

import type { RDTFit, RDTFitUnavailable, RDTResults } from "@src/types/api";
import Alert from "@components/Alert";
import Tooltip from "@components/Tooltip";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";

type RDTResultsSummaryProps = {
  results: RDTResults;
  showTooltips?: boolean;
  // See the same prop on ResultsSummary: the default two-column split keys off
  // the viewport, so pass 1 when the component itself is rendered narrow.
  columns?: 1 | 2;
};

const formatNumber = (value: number, digits = 3): string =>
  Number.isFinite(value) ? value.toFixed(digits) : String(value);

const formatCI = (ci: [number, number]): string =>
  `[${formatNumber(ci[0])}, ${formatNumber(ci[1])}]`;

const formatPValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value < 0.001 ? "< 0.001" : value.toFixed(3);
};

/** One check fit as "jump [CI]", or the reason it could not be computed. */
const formatFit = (fit: RDTFit | RDTFitUnavailable): string =>
  fit.unavailable !== undefined
    ? `${TEXT.rdt.results.checks.unavailable} (${fit.unavailable})`
    : `${formatNumber(fit.jump)} ${formatCI(fit.jumpCI)}`;

type Metric = {
  label: string;
  value: string;
  subValue?: string;
  tooltip: string;
};

type CheckRow = {
  label: string;
  value: string;
  note: string;
  warning?: string;
};

/**
 * Panel for the Residual Discontinuity Test (#559). RDT is a diagnostic, not
 * an estimator: the panel shows the jump in residual precision at |t| = 1.96,
 * the smallest jump the data could have detected, the estimation window, and
 * three checks. Lower residual = more precise than sample size predicts, so
 * the p-hacking signature is a negative jump; that sentence is on the panel
 * because the sign is the easiest thing here to misread.
 */
export default function RDTResultsSummary({
  results,
  showTooltips = false,
  columns = 2,
}: RDTResultsSummaryProps) {
  const text = TEXT.rdt.results;

  const metrics: Metric[] = [
    {
      label: text.jump.label,
      value: `${formatNumber(results.jump)} ${formatCI(results.jumpCI)}`,
      subValue: `SE ${formatNumber(results.jumpSE)}, p = ${formatPValue(results.pValue)}; ${text.jump.subLabel}`,
      tooltip: text.jump.tooltip,
    },
    {
      label: text.detectable.label,
      value: formatNumber(results.minDetectableJump),
      subValue: text.detectable.subLabel,
      tooltip: text.detectable.tooltip,
    },
    {
      label: text.window.label,
      value: `|t| from ${formatNumber(results.windowT[0], 2)} to ${formatNumber(results.windowT[1], 2)} (bandwidth ${formatNumber(results.bandwidth, 2)} log points)`,
      subValue: `${results.nLeft} below and ${results.nRight} above the cutoff inside it, ${results.studies} ${
        results.hasStudyColumn ? "studies" : "estimates as clusters"
      }; ${results.k} rows used, ${results.droppedRows} dropped`,
      tooltip: text.window.tooltip,
    },
  ];

  const firstStageWarning =
    results.firstStage.rSquared > 0.99
      ? text.checks.firstStage.warning
      : undefined;

  const checks: CheckRow[] = [
    {
      label: text.checks.firstStage.label,
      value: `slope ${formatNumber(results.firstStage.slope)}, R² ${formatNumber(results.firstStage.rSquared)}`,
      note: text.checks.firstStage.note,
      warning: firstStageWarning,
    },
    {
      label: text.checks.sensitivity.label,
      value: `h/2: ${formatFit(results.sensitivity.half)}; 2h: ${formatFit(results.sensitivity.double)}`,
      note: text.checks.sensitivity.note,
    },
    {
      label: text.checks.placebo.label,
      value: `at |t| = ${
        results.placebo.below.unavailable === undefined
          ? formatNumber(results.placebo.below.cutoff, 2)
          : "median below"
      }: ${formatFit(results.placebo.below)}; at |t| = ${
        results.placebo.above.unavailable === undefined
          ? formatNumber(results.placebo.above.cutoff, 2)
          : "median above"
      }: ${formatFit(results.placebo.above)}`,
      note: text.checks.placebo.note,
    },
  ];

  const warnings = results.warnings ?? [];

  const withTooltip = (key: string, tooltip: string, content: JSX.Element) =>
    showTooltips ? (
      <Tooltip
        key={key}
        content={tooltip}
        visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
      >
        {content}
      </Tooltip>
    ) : (
      <div key={key}>{content}</div>
    );

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">{text.title}</h2>
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
      <div
        className={
          columns === 1
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
        }
      >
        {metrics.map((metric) =>
          withTooltip(
            metric.label,
            metric.tooltip,
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
            </div>,
          ),
        )}
      </div>

      <h3 className="text-base font-semibold mt-6 mb-2">{text.checks.title}</h3>
      <ol className="space-y-3">
        {checks.map((check) => (
          <li key={check.label}>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {check.label}
            </p>
            <p className="font-medium">{check.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {check.note}
            </p>
            {check.warning ? (
              <Alert
                message={check.warning}
                type={CONST.ALERT_TYPES.WARNING}
                className="mt-2"
              />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>{text.interpretation}</p>
        <p>{text.caution}</p>
      </div>
    </div>
  );
}
