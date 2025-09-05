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

    tooltipMap[TEXT.results.effectEstimate.metrics.estimate.label] =
      TEXT.results.effectEstimate.metrics.estimate.tooltip("MAIVE");
    tooltipMap[TEXT.results.effectEstimate.metrics.standardError.label] =
      TEXT.results.effectEstimate.metrics.standardError.tooltip;
    tooltipMap[TEXT.results.effectEstimate.metrics.significance.label] =
      TEXT.results.effectEstimate.metrics.significance.tooltip;
    tooltipMap[TEXT.results.publicationBias.metrics.pValue.label] =
      TEXT.results.publicationBias.metrics.pValue.tooltip;
    tooltipMap[TEXT.results.publicationBias.metrics.significance.label] =
      TEXT.results.publicationBias.metrics.significance.tooltip;
    tooltipMap[TEXT.results.effectEstimate.metrics.andersonRubinCI.label] =
      TEXT.results.effectEstimate.metrics.andersonRubinCI.tooltip;
    tooltipMap[TEXT.results.diagnosticTests.metrics.firstStageFTest.label] =
      TEXT.results.diagnosticTests.metrics.firstStageFTest.tooltip;
    tooltipMap[TEXT.results.diagnosticTests.metrics.hausmanTest.label] =
      TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip;
    tooltipMap[TEXT.results.diagnosticTests.metrics.hausmanTest.label] =
      TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip;
    tooltipMap[
      TEXT.results.diagnosticTests.metrics.hausmanCriticalValue.label
    ] = TEXT.results.diagnosticTests.metrics.hausmanCriticalValue.tooltip;
    tooltipMap[TEXT.results.diagnosticTests.metrics.hausmanTest.label] =
      TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip;
    tooltipMap[TEXT.results.effectEstimate.metrics.bootCIEffect.label] =
      TEXT.results.effectEstimate.metrics.bootCIEffect.tooltip;
    tooltipMap[TEXT.results.effectEstimate.metrics.bootCISE.label] =
      TEXT.results.effectEstimate.metrics.bootCISE.tooltip;
    tooltipMap[TEXT.results.effectEstimate.metrics.bootSEEffect.label] =
      TEXT.results.effectEstimate.metrics.bootSEEffect.tooltip;
    tooltipMap[TEXT.results.effectEstimate.metrics.bootSESE.label] =
      TEXT.results.effectEstimate.metrics.bootSESE.tooltip;

    return tooltipMap[label] || "";
  };

  const getSectionTitle = (section: string): string => {
    const sectionTitles: Record<string, string> = {
      effect: TEXT.results.effectEstimate.title,
      bias: TEXT.results.publicationBias.title,
      tests: TEXT.results.diagnosticTests.title,
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

  const allResults = [
    ...resultsData.coreResults,
    ...resultsData.conditionalResults,
    ...resultsData.bootstrapResults,
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
  const sectionOrder = ["effect", "bias", "tests"];

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
