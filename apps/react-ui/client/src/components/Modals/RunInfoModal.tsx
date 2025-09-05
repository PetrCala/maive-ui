"use client";

import type { ModelParameters, ModelResults } from "@src/types";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
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
          <div className="space-y-3">
            {Object.entries(parameters).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-center py-2 border-b border-gray-500"
              >
                <span className="text-secondary">
                  {getParameterDisplayName(key as keyof ModelParameters)}:
                </span>
                <span className="font-medium text-right max-w-xs truncate">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-secondary">Effect Estimate:</span>
                <span className="font-medium">
                  {results.effectEstimate.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Standard Error:</span>
                <span className="font-medium">
                  {results.standardError.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Significant:</span>
                <span
                  className={`font-medium ${
                    results.isSignificant ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {results.isSignificant ? "Yes" : "No"}
                </span>
              </div>
              {results.andersonRubinCI !== "NA" && (
                <div className="flex justify-between">
                  <span className="text-secondary">Anderson-Rubin CI:</span>
                  <span className="font-medium text-right">
                    [{results.andersonRubinCI[0].toFixed(4)},{" "}
                    {results.andersonRubinCI[1].toFixed(4)}]
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-secondary">
                  Publication Bias p-value:
                </span>
                <span className="font-medium">
                  {results.publicationBias.pValue.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Bias Significant:</span>
                <span
                  className={`font-medium ${
                    results.publicationBias.isSignificant
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {results.publicationBias.isSignificant ? "Yes" : "No"}
                </span>
              </div>
              {results.firstStageFTest !== "NA" && (
                <div className="flex justify-between">
                  <span className="text-secondary">First Stage F-test:</span>
                  <span className="font-medium">
                    {results.firstStageFTest.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Hausman Test:</span>
                <span className="font-medium text-right">
                  {results.hausmanTest.statistic.toFixed(4)} (CV:{" "}
                  {results.hausmanTest.criticalValue.toFixed(4)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Hausman Rejects:</span>
                <span
                  className={`font-medium ${
                    results.hausmanTest.rejectsNull
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {results.hausmanTest.rejectsNull ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Bootstrap Results */}
          {(results.bootCI !== "NA" || results.bootSE !== "NA") && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium text-primary mb-3">
                Bootstrap Results
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {results.bootCI !== "NA" && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-secondary">
                        Bootstrap CI (Effect):
                      </span>
                      <span className="font-medium text-right">
                        [{results.bootCI[0][0].toFixed(4)},{" "}
                        {results.bootCI[0][1].toFixed(4)}]
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Bootstrap CI (SE):</span>
                      <span className="font-medium text-right">
                        [{results.bootCI[1][0].toFixed(4)},{" "}
                        {results.bootCI[1][1].toFixed(4)}]
                      </span>
                    </div>
                  </div>
                )}
                {results.bootSE !== "NA" && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-secondary">
                        Bootstrap SE (Effect):
                      </span>
                      <span className="font-medium">
                        {results.bootSE[0].toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Bootstrap SE (SE):</span>
                      <span className="font-medium">
                        {results.bootSE[1].toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </BaseModal>
  );
}
