"use client";

import type { ModelParameters, ModelResults } from "@src/types";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import ResultsSummary from "@src/components/ResultsSummary";
import BaseModal from "./BaseModal";

type RunInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  parameters: ModelParameters;
  results: ModelResults;
  dataInfo?: {
    filename: string;
    rowCount: number;
    hasStudyId: boolean;
  };
  runDuration?: number; // in milliseconds
  runTimestamp?: Date;
};

export default function RunInfoModal({
  isOpen,
  onClose,
  parameters,
  results,
  dataInfo,
  runDuration,
  runTimestamp,
}: RunInfoModalProps) {
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

  const getParameterDisplayName = (key: keyof ModelParameters): string => {
    return TEXT.model[key].label;
  };

  const getParameterValue = (
    key: keyof ModelParameters,
    value: unknown,
  ): string => {
    switch (key) {
      case "modelType":
        return value as string;
      case "includeStudyDummies":
      case "includeStudyClustering":
      case "computeAndersonRubin":
      case "shouldUseInstrumenting":
        return value ? "Yes" : "No";
      case "standardErrorTreatment":
        const seTreatment = value as string;
        const seOption = Object.values(CONST.STANDARD_ERROR_TREATMENTS).find(
          (option) => option.VALUE === seTreatment,
        );
        return seOption?.TEXT ?? seTreatment;
      case "maiveMethod":
        return value as string;
      case "weight":
        const weightValue = value as string;
        const weightOption = Object.values(CONST.WEIGHT_OPTIONS).find(
          (option) => option.VALUE === weightValue,
        );
        return weightOption?.TEXT ?? weightValue;
      default:
        return String(value);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      maxHeight="max-h-[90vh]"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-primary">
        <h2 className="text-2xl font-bold text-primary">Run Information</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Run Details */}
        <section>
          <h3 className="text-xl font-semibold text-primary mb-3">
            Run Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-secondary">Duration:</span>
                <span className="font-medium">
                  {formatDuration(runDuration)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Completed:</span>
                <span className="font-medium">
                  {formatTimestamp(runTimestamp)}
                </span>
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
        </section>

        {/* Model Parameters */}
        <section>
          <h3 className="text-xl font-semibold text-primary mb-3">
            Run Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {Object.entries(parameters).map(([key, value], index) => (
              <div
                key={key}
                className={`flex justify-between items-start py-1 ${
                  index % 2 === 0 ? "md:pr-4" : "md:pl-4"
                }`}
              >
                <span className="text-secondary flex-shrink-0 mr-2">
                  {getParameterDisplayName(key as keyof ModelParameters)}:
                </span>
                <span className="font-medium text-right break-words min-w-0">
                  {getParameterValue(key as keyof ModelParameters, value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Results Summary */}
        <section>
          <h3 className="text-xl font-semibold text-primary mb-3">
            Results Summary
          </h3>
          <ResultsSummary
            results={results}
            variant="detailed"
            showBootstrapSection={true}
            layout="vertical"
          />
        </section>
      </div>
    </BaseModal>
  );
}
