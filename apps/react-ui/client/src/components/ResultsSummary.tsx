"use client";

import type { ModelResults } from "@src/types";

type ResultsSummaryProps = {
  results: ModelResults;
  variant?: "detailed" | "simple";
  showBootstrapSection?: boolean;
  layout?: "horizontal" | "vertical"; // horizontal = x-axis, vertical = y-axis
};

type ResultItem = {
  label: string;
  value: string | number;
  isSignificant?: boolean;
  isSignificantType?: "positive" | "negative"; // positive = green, negative = red
  show?: boolean;
};

export default function ResultsSummary({
  results,
  variant = "detailed",
  showBootstrapSection = true,
  layout = "horizontal",
}: ResultsSummaryProps) {
  const formatValue = (value: number, decimals = 4): string => {
    return value.toFixed(decimals);
  };

  const formatCI = (ci: [number, number]): string => {
    return `[${formatValue(ci[0])}, ${formatValue(ci[1])}]`;
  };

  const getSignificanceColor = (
    isSignificant: boolean,
    type: "positive" | "negative",
  ): string => {
    if (!isSignificant) {
      return "text-gray-600 dark:text-gray-400";
    }
    return type === "positive" ? "text-green-600" : "text-red-600";
  };

  // Core results that are always shown
  const coreResults: ResultItem[] = [
    {
      label: "Effect Estimate",
      value: formatValue(results.effectEstimate),
      show: true,
    },
    {
      label: "Standard Error",
      value: formatValue(results.standardError),
      show: true,
    },
    {
      label: "Significant",
      value: results.isSignificant ? "Yes" : "No",
      isSignificant: results.isSignificant,
      isSignificantType: "positive",
      show: true,
    },
    {
      label: "Publication Bias p-value",
      value: formatValue(results.publicationBias.pValue),
      show: true,
    },
    {
      label: "Bias Significant",
      value: results.publicationBias.isSignificant ? "Yes" : "No",
      isSignificant: results.publicationBias.isSignificant,
      isSignificantType: "negative",
      show: true,
    },
  ];

  // Conditional results
  const conditionalResults: ResultItem[] = [
    {
      label: "Anderson-Rubin CI",
      value:
        results.andersonRubinCI !== "NA"
          ? formatCI(results.andersonRubinCI)
          : "N/A",
      show: results.andersonRubinCI !== "NA",
    },
    {
      label: "First Stage F-test",
      value:
        results.firstStageFTest !== "NA"
          ? formatValue(results.firstStageFTest)
          : "N/A",
      show: results.firstStageFTest !== "NA",
    },
    {
      label: "Hausman Test",
      value:
        variant === "detailed"
          ? `${formatValue(results.hausmanTest.statistic)} (CV: ${formatValue(results.hausmanTest.criticalValue)})`
          : formatValue(results.hausmanTest.statistic),
      show: true,
    },
    {
      label: "Hausman Rejects",
      value: results.hausmanTest.rejectsNull ? "Yes" : "No",
      isSignificant: results.hausmanTest.rejectsNull,
      isSignificantType: "negative",
      show: true,
    },
  ];

  // Bootstrap results
  const bootstrapResults: ResultItem[] = [
    {
      label: "Bootstrap CI (Effect)",
      value: results.bootCI !== "NA" ? formatCI(results.bootCI[0]) : "N/A",
      show: results.bootCI !== "NA",
    },
    {
      label: "Bootstrap CI (SE)",
      value: results.bootCI !== "NA" ? formatCI(results.bootCI[1]) : "N/A",
      show: results.bootCI !== "NA",
    },
    {
      label: "Bootstrap SE (Effect)",
      value: results.bootSE !== "NA" ? formatValue(results.bootSE[0]) : "N/A",
      show: results.bootSE !== "NA",
    },
    {
      label: "Bootstrap SE (SE)",
      value: results.bootSE !== "NA" ? formatValue(results.bootSE[1]) : "N/A",
      show: results.bootSE !== "NA",
    },
  ];

  // Combine all results and filter out hidden ones
  const allResults = [...coreResults, ...conditionalResults];
  const visibleResults = allResults.filter((result) => result.show);

  // Split results into two columns for balanced display (column-wise population)
  const midPoint = Math.ceil(visibleResults.length / 2);
  const leftColumnResults = visibleResults.slice(0, midPoint);
  const rightColumnResults = visibleResults.slice(midPoint);

  // Add bootstrap results to the shorter column to balance
  const bootstrapVisible = bootstrapResults.filter((result) => result.show);
  if (bootstrapVisible.length > 0 && showBootstrapSection) {
    if (leftColumnResults.length <= rightColumnResults.length) {
      leftColumnResults.push(...bootstrapVisible);
    } else {
      rightColumnResults.push(...bootstrapVisible);
    }
  }

  const renderResultItem = (item: ResultItem, key: string) => (
    <div key={key} className="flex justify-between">
      <span className="text-secondary">{item.label}:</span>
      <span
        className={`font-medium ${
          item.isSignificant !== undefined
            ? getSignificanceColor(
                item.isSignificant,
                item.isSignificantType ?? "positive",
              )
            : ""
        }`}
      >
        {item.value}
      </span>
    </div>
  );

  if (variant === "simple") {
    // Simple variant for export/summary
    return (
      <div className="space-y-2 text-sm">
        {visibleResults.map((item, index) => (
          <div key={index} className="flex justify-between">
            <span className="text-secondary">{item.label}:</span>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
        {bootstrapVisible.length > 0 && showBootstrapSection && (
          <>
            <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="font-medium text-primary mb-2">
                Bootstrap Results
              </div>
              {bootstrapVisible.map((item, index) => (
                <div
                  key={`bootstrap-${index}`}
                  className="flex justify-between"
                >
                  <span className="text-secondary">{item.label}:</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Detailed variant for modal display
  if (layout === "vertical") {
    // Y-axis population: all results in two columns
    return (
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {leftColumnResults.map((item, index) =>
              renderResultItem(item, `left-${index}`),
            )}
          </div>
          <div className="space-y-2">
            {rightColumnResults.map((item, index) =>
              renderResultItem(item, `right-${index}`),
            )}
          </div>
        </div>
        {bootstrapVisible.length > 0 && showBootstrapSection && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="font-medium text-primary mb-3">
              Bootstrap Results
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {bootstrapVisible
                  .slice(0, Math.ceil(bootstrapVisible.length / 2))
                  .map((item, index) =>
                    renderResultItem(item, `bootstrap-left-${index}`),
                  )}
              </div>
              <div className="space-y-2">
                {bootstrapVisible
                  .slice(Math.ceil(bootstrapVisible.length / 2))
                  .map((item, index) =>
                    renderResultItem(item, `bootstrap-right-${index}`),
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Horizontal layout (default)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="space-y-2">
        {leftColumnResults.map((item, index) =>
          renderResultItem(item, `left-${index}`),
        )}
      </div>
      <div className="space-y-2">
        {rightColumnResults.map((item, index) =>
          renderResultItem(item, `right-${index}`),
        )}
      </div>
    </div>
  );
}
