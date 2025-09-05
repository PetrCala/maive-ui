"use client";

type RunDetailsProps = {
  runDuration?: number;
  runTimestamp?: Date;
  dataInfo?: {
    filename: string;
    rowCount: number;
    hasStudyId: boolean;
  };
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-secondary">Duration:</span>
          <span className="font-medium">{formatDuration(runDuration)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">Completed:</span>
          <span className="font-medium">{formatTimestamp(runTimestamp)}</span>
        </div>
      </div>
      {dataInfo && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-secondary">Data File:</span>
            <span
              className="font-medium truncate ml-2"
              title={dataInfo.filename}
            >
              {dataInfo.filename}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Observations:</span>
            <span className="font-medium">{dataInfo.rowCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
