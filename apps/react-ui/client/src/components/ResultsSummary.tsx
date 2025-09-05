"use client";

import type { ModelResults } from "@src/types";
import {
  generateResultsData,
  type ResultItem,
} from "@src/utils/resultsDataUtils";
import Tooltip from "@components/Tooltip";
import TEXT from "@src/lib/text";
import CONFIG from "@src/CONFIG";

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
  showTooltips?: boolean;
};

export default function ResultsSummary({
  results,
  variant = "detailed",
  layout = "horizontal",
  runDuration,
  runTimestamp,
  dataInfo,
  showTooltips = false,
}: ResultsSummaryProps) {
  const getValueDisplay = (item: ResultItem): string => {
    const baseValue = item.value.toString();
    return item.extraText ? `${baseValue}${item.extraText}` : baseValue;
  };

  const getValueClassName = (item: ResultItem): string => {
    const baseClass = "text-lg font-medium";
    return item.highlightColor
      ? `${baseClass} ${item.highlightColor}`
      : baseClass;
  };

  const getTooltipContent = (label: string): string => {
    const tooltipMap: Record<string, string> = {};

    tooltipMap["Effect Estimate"] =
      TEXT.results.effectEstimate.metrics.estimate.tooltip("MAIVE");
    tooltipMap["Standard Error"] =
      TEXT.results.effectEstimate.metrics.standardError.tooltip;
    tooltipMap.Significant =
      TEXT.results.effectEstimate.metrics.significance.tooltip;
    tooltipMap["Publication Bias p-value"] =
      TEXT.results.publicationBias.metrics.pValue.tooltip;
    tooltipMap["Publication Bias Significant"] =
      TEXT.results.publicationBias.metrics.significance.tooltip;
    tooltipMap["Anderson-Rubin CI"] =
      TEXT.results.effectEstimate.metrics.andersonRubinCI.tooltip;
    tooltipMap["First Stage F-test"] =
      TEXT.results.diagnosticTests.metrics.firstStageFTest.tooltip;
    tooltipMap["Hausman Test"] =
      TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip;
    tooltipMap["Hausman Test Statistic"] =
      TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip;
    tooltipMap["Hausman Critical Value"] =
      TEXT.results.diagnosticTests.metrics.hausmanCriticalValue.tooltip;
    tooltipMap["Hausman Rejects Null"] =
      TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip;
    tooltipMap["Bootstrap CI (Effect)"] =
      TEXT.results.effectEstimate.metrics.bootCI.tooltip;
    tooltipMap["Bootstrap CI (SE)"] =
      TEXT.results.effectEstimate.metrics.bootCI.tooltip;
    tooltipMap["Bootstrap SE (Effect)"] =
      TEXT.results.effectEstimate.metrics.bootCI.tooltip;
    tooltipMap["Bootstrap SE (SE)"] =
      TEXT.results.effectEstimate.metrics.bootCI.tooltip;

    return tooltipMap[label] || "";
  };

  const getSectionTitle = (section: string): string => {
    const sectionTitles: Record<string, string> = {
      effect: TEXT.results.effectEstimate.title,
      bias: TEXT.results.publicationBias.title,
      tests: TEXT.results.diagnosticTests.title,
      bootstrap: "Bootstrap Results",
      runInfo: "Run Information",
    };
    return sectionTitles[section] || "";
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

  // Helper function to split results into two columns for a section
  const splitIntoColumns = (items: ResultItem[]) => {
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
    const valueClassDetailed = getValueClassName(item);
    const valueClassSimple = item.highlightColor
      ? `text-md font-medium ${item.highlightColor}`
      : "text-md font-medium";

    let content;
    if (variant === "detailed") {
      content = (
        <div>
          <p className={labelClass}>{item.label}</p>
          <p className={valueClassDetailed}>{getValueDisplay(item)}</p>
        </div>
      );
    } else {
      content = (
        <div className="flex justify-between">
          <span className={labelClass}>{item.label}:</span>
          <span className={valueClassSimple}>{getValueDisplay(item)}</span>
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
    // Y-axis population: all results in two columns (keep old logic for modal)
    const midPoint = Math.ceil(visibleResults.length / 2);
    const leftColumnResults = visibleResults.slice(0, midPoint);
    const rightColumnResults = visibleResults.slice(midPoint);

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

  // Horizontal layout (default) - render sections dynamically
  const sectionOrder = ["effect", "bias", "tests", "bootstrap", "runInfo"];

  return (
    <div className="space-y-6">
      {sectionOrder.map((sectionKey) => {
        const sectionResults = resultsBySection[sectionKey];
        if (!sectionResults || sectionResults.length === 0) {
          return null;
        }

        const { left, right } = splitIntoColumns(sectionResults);
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
