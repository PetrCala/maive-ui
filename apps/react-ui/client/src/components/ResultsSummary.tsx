"use client";

import type { ModelResults } from "@src/types";
import {
  generateResultsData,
  type ResultItem,
} from "@src/utils/resultsDataUtils";

type ResultsSummaryProps = {
  results: ModelResults;
  variant?: "detailed" | "simple";
  layout?: "horizontal" | "vertical"; // horizontal = x-axis, vertical = y-axis
  runDuration?: number;
  runTimestamp?: Date;
  dataInfo?: {
    filename: string;
    rowCount: number;
    hasStudyId: boolean;
  };
};

export default function ResultsSummary({
  results,
  variant = "detailed",
  layout = "horizontal",
  runDuration,
  runTimestamp,
  dataInfo,
}: ResultsSummaryProps) {
  const getSignificanceColor = (
    isSignificant: boolean,
    type: "positive" | "negative",
  ): string => {
    if (!isSignificant) {
      return "text-gray-600 dark:text-gray-400";
    }
    return type === "positive" ? "text-green-600" : "text-red-600";
  };

  // Generate results data using the utility function
  const resultsData = generateResultsData(
    results,
    undefined,
    runDuration,
    runTimestamp,
    dataInfo,
  );

  // Transform the data for display (add significance types and adjust formatting)
  const coreResults: ResultItem[] = resultsData.coreResults.map((item) => ({
    ...item,
    isSignificantType:
      item.label === "Significant"
        ? "positive"
        : item.label === "Publication Bias Significant"
          ? "negative"
          : undefined,
  }));

  const conditionalResults: ResultItem[] = resultsData.conditionalResults.map(
    (item) => {
      // Special handling for Hausman Test in detailed mode
      if (item.label === "Hausman Test Statistic" && variant === "detailed") {
        const criticalValue = resultsData.conditionalResults.find(
          (r) => r.label === "Hausman Critical Value",
        );
        return {
          ...item,
          label: "Hausman Test",
          value: `${item.value} (CV: ${criticalValue?.value ?? "N/A"})`,
          isSignificantType: "negative",
        };
      }
      return {
        ...item,
        isSignificantType:
          item.label === "Hausman Rejects Null" ? "negative" : undefined,
      };
    },
  );

  const bootstrapResults: ResultItem[] = resultsData.bootstrapResults.map(
    (item) => ({
      ...item,
      value: item.value === "NA" ? "N/A" : item.value,
    }),
  );

  // Combine all results and filter out hidden ones
  const allResults = [
    ...coreResults,
    ...conditionalResults,
    ...bootstrapResults,
  ];
  const visibleResults = allResults.filter((result) => result.show);

  // Split results into two columns for balanced display (column-wise population)
  const midPoint = Math.ceil(visibleResults.length / 2);
  const leftColumnResults = visibleResults.slice(0, midPoint);
  const rightColumnResults = visibleResults.slice(midPoint);

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
