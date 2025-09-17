"use client";

import type { ModelResults, ModelParameters } from "@src/types";
import type { DataInfo } from "@src/types/data";
import {
  generateResultsData,
  type ResultItem,
} from "@src/utils/resultsDataUtils";
import Tooltip from "@components/Tooltip";
import TEXT from "@src/lib/text";
import CONFIG from "@src/CONFIG";

type ResultsTextContent = typeof TEXT.results;

type ResultsSummaryProps = {
  results: ModelResults;
  parameters?: ModelParameters;
  variant?: "detailed" | "simple";
  layout?: "horizontal" | "vertical"; // horizontal = x-axis, vertical = y-axis
  runDuration?: number;
  runTimestamp?: Date;
  dataInfo?: DataInfo;
  showTooltips?: boolean;
  resultsText?: ResultsTextContent;
};

export default function ResultsSummary({
  results,
  parameters,
  variant = "detailed",
  layout = "horizontal",
  runDuration,
  runTimestamp,
  dataInfo,
  showTooltips = false,
  resultsText = TEXT.results,
}: ResultsSummaryProps) {
  const getValueDisplay = (item: ResultItem): string => {
    let baseValue: string;

    if (typeof item.value === "number") {
      baseValue = Number.isFinite(item.value)
        ? item.value.toFixed(3)
        : item.value.toString();
    } else {
      baseValue = item.value.toString();
    }

    return item.extraText ? `${baseValue}${item.extraText}` : baseValue;
  };

  const getValueStyle = (item: ResultItem): React.CSSProperties => {
    if (!item.highlightColor) {
      return {};
    }

    // Convert Tailwind color classes to inline styles
    if (item.highlightColor.includes("text-green-600")) {
      return { color: "#16a34a" }; // Tailwind green-600
    }
    if (item.highlightColor.includes("text-green-400")) {
      return { color: "#22c55e" }; // Tailwind green-400
    }
    if (item.highlightColor.includes("text-red-600")) {
      return { color: "#dc2626" }; // Tailwind red-600
    }
    if (item.highlightColor.includes("text-red-400")) {
      return { color: "#f87171" }; // Tailwind red-400
    }

    return {};
  };

  const getTooltipContent = (label: string): string => {
    type TooltipContent = {
      label: string;
      tooltip: string;
    };
    for (const sectionKey of Object.keys(resultsText)) {
      const section = (
        resultsText as unknown as Record<string, Record<string, TooltipContent>>
      )[sectionKey];
      if (section?.metrics) {
        for (const metricKey of Object.keys(section.metrics)) {
          const metric = section.metrics[
            metricKey as keyof typeof section.metrics
          ] as unknown as TooltipContent;
          if (metric && metric.label === label && metric.tooltip) {
            return metric.tooltip;
          }
        }
      }
    }

    return "";
  };

  const getSectionTitle = (section: string): string => {
    const sectionTitles: Record<string, string> = {
      effect: resultsText.effectEstimate.title,
      bias: resultsText.publicationBias.title,
      tests: resultsText.diagnosticTests.title,
    };
    return sectionTitles[section] || "";
  };

  // Generate results data using the utility function
  const resultsData = generateResultsData(
    results,
    parameters,
    runDuration,
    runTimestamp,
    dataInfo,
    resultsText,
  );

  const allResults = [...resultsData.coreResults];

  const visibleResults = allResults.filter((result) => result.show);

  // Group results by section
  const resultsBySection = visibleResults.reduce(
    (acc, result) => {
      if (!acc[result.section]) {
        acc[result.section] = [];
      }
      acc[result.section].push(result);
      return acc;
    },
    {} as Record<string, ResultItem[]>,
  );

  const splitIntoColumns = (
    items: ResultItem[],
    orientation: "horizontal" | "vertical",
  ) => {
    if (orientation === "horizontal") {
      return {
        left: items.filter((_, idx) => idx % 2 === 0),
        right: items.filter((_, idx) => idx % 2 === 1),
      };
    }
    const midPoint = Math.ceil(items.length / 2);
    return {
      left: items.slice(0, midPoint),
      right: items.slice(midPoint),
    };
  };

  const renderResultItem = (item: ResultItem, key: string) => {
    const tooltipContent = getTooltipContent(item.label);
    const shouldShowTooltip = showTooltips && tooltipContent;

    const labelClass = "text-sm text-gray-600 dark:text-gray-300";
    const valueClassDetailed = "text-lg font-medium";
    const valueClassSimple = "text-md font-medium";
    const valueStyle = getValueStyle(item);

    let content;
    if (variant === "detailed") {
      content = (
        <div>
          <p className={labelClass}>{item.label}</p>
          <p className={valueClassDetailed} style={valueStyle}>
            {getValueDisplay(item)}
          </p>
        </div>
      );
    } else {
      content = (
        <div className="flex justify-between">
          <span className={labelClass}>{item.label}:</span>
          <span className={valueClassSimple} style={valueStyle}>
            {getValueDisplay(item)}
          </span>
        </div>
      );
    }

    if (shouldShowTooltip) {
      return (
        <Tooltip
          key={key}
          content={tooltipContent}
          visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
        >
          {content}
        </Tooltip>
      );
    }

    return <div key={key}>{content}</div>;
  };

  // Detailed variant for modal display
  if (layout === "vertical") {
    const { left, right } = splitIntoColumns(visibleResults, "vertical");

    return (
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {left.map((item, index) => renderResultItem(item, `left-${index}`))}
          </div>
          <div className="space-y-2">
            {right.map((item, index) =>
              renderResultItem(item, `right-${index}`),
            )}
          </div>
        </div>
      </div>
    );
  }

  // Horizontal layout (default) - render sections dynamically
  const sectionOrder = ["effect", "bias", "tests"];

  return (
    <div className="space-y-6">
      {sectionOrder.map((sectionKey) => {
        const sectionResults = resultsBySection[sectionKey];
        if (!sectionResults || sectionResults.length === 0) {
          return null;
        }

        const { left, right } = splitIntoColumns(sectionResults, "horizontal");
        const sectionTitle = getSectionTitle(sectionKey);

        return (
          <div
            key={sectionKey}
            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <h2 className="text-xl font-semibold mb-4">{sectionTitle}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={"space-y-4"}>
                {left.map((item, index) => (
                  <div key={`${sectionKey}-left-${index}`}>
                    {renderResultItem(item, `${sectionKey}-left-${index}`)}
                  </div>
                ))}
              </div>
              <div className={"space-y-4"}>
                {right.map((item, index) => (
                  <div key={`${sectionKey}-right-${index}`}>
                    {renderResultItem(item, `${sectionKey}-right-${index}`)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
