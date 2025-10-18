"use client";

import type { DataInfo } from "@src/types/data";

type RunDetailsProps = {
  runDuration?: number;
  runTimestamp?: Date;
  dataInfo?: DataInfo;
};

type DetailItem = {
  label: string;
  value: string | number;
  show: boolean;
  tooltip?: string;
};

export default function RunDetails({
  runDuration,
  runTimestamp,
  dataInfo,
}: RunDetailsProps) {
  const formatDuration = (ms?: number): string => {
    if (!ms) {
      return "Unknown";
    }
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp?: Date): string => {
    if (!timestamp) {
      return "Unknown";
    }
    return timestamp.toLocaleString();
  };

  // Create a data-driven list of all available information
  const runDetails: DetailItem[] = [
    {
      label: "Duration",
      value: formatDuration(runDuration),
      show: true,
    },
    {
      label: "Completed",
      value: formatTimestamp(runTimestamp),
      show: true,
    },
  ];

  const dataDetails: DetailItem[] = dataInfo
    ? [
        {
          label: "Data File",
          value: dataInfo.filename,
          show: true,
          tooltip: dataInfo.filename,
        },
        {
          label: "Observations",
          value: dataInfo.rowCount,
          show: true,
        },
        {
          label: "Has Study ID",
          value: dataInfo.hasStudyId ? "Yes" : "No",
          show: true,
        },
        {
          label: "Number of Studies",
          value: dataInfo.studyCount ?? "N/A",
          show: dataInfo.studyCount !== undefined,
        },
        {
          label: "Median Observations per Study",
          value: dataInfo.medianObservationsPerStudy
            ? dataInfo.medianObservationsPerStudy.toFixed(1)
            : "N/A",
          show: dataInfo.medianObservationsPerStudy !== undefined,
        },
        ...(dataInfo.subsampleFilter?.summary
          ? [
              {
                label: "Subsample Filter",
                value: dataInfo.subsampleFilter.summary,
                show: true,
                tooltip: dataInfo.subsampleFilter.summary,
              } satisfies DetailItem,
            ]
          : []),
        ...(dataInfo.subsampleFilter?.rowSummary
          ? [
              {
                label: "Rows Matching Filter",
                value: dataInfo.subsampleFilter.rowSummary,
                show: true,
              } satisfies DetailItem,
            ]
          : []),
      ]
    : [];

  const allDetails = [...runDetails, ...dataDetails];
  const visibleDetails = allDetails.filter((detail) => detail.show);

  // Split details into two columns for better layout
  const midPoint = Math.ceil(visibleDetails.length / 2);
  const leftColumn = visibleDetails.slice(0, midPoint);
  const rightColumn = visibleDetails.slice(midPoint);

  const renderDetailItem = (item: DetailItem) => (
    <div key={item.label} className="flex justify-between">
      <span className="text-secondary">{item.label}:</span>
      <span
        className="font-medium truncate ml-2"
        title={item.tooltip ?? String(item.value)}
      >
        {item.value}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="space-y-2">{leftColumn.map(renderDetailItem)}</div>
      <div className="space-y-2">{rightColumn.map(renderDetailItem)}</div>
    </div>
  );
}
