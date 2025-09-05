"use client";

import type { ModelParameters, ModelResults } from "@src/types";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import ResultsSummary from "@src/components/ResultsSummary";
import RunDetails from "@src/components/RunDetails";
import BaseModal from "./BaseModal";
import { FaDownload } from "react-icons/fa";

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
  onExportButtonClick: () => void;
};

export default function RunInfoModal({
  isOpen,
  onClose,
  parameters,
  results,
  dataInfo,
  runDuration,
  runTimestamp,
  onExportButtonClick,
}: RunInfoModalProps) {
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
      actionButton={{
        icon: <FaDownload className="w-5 h-5" />,
        onClick: onExportButtonClick,
        ariaLabel: "Export comprehensive results",
        className: "text-blue-600 hover:text-blue-700",
      }}
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
          <RunDetails
            runDuration={runDuration}
            runTimestamp={runTimestamp}
            dataInfo={dataInfo}
          />
        </section>

        {/* Model Parameters */}
        <section>
          <h3 className="text-xl font-semibold text-primary mb-3">
            Run Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
            {(() => {
              const parameterEntries = Object.entries(parameters);
              const midPoint = Math.ceil(parameterEntries.length / 2);
              const leftColumnParams = parameterEntries.slice(0, midPoint);
              const rightColumnParams = parameterEntries.slice(midPoint);

              const renderParameter = (
                [key, value]: [string, unknown],
                isLeftColumn: boolean,
              ) => {
                const displayName = getParameterDisplayName(
                  key as keyof ModelParameters,
                );
                const truncationLength = 30;
                const truncatedName =
                  displayName.length > truncationLength
                    ? `${displayName.substring(0, truncationLength - 3)}...`
                    : displayName;

                return (
                  <div
                    key={key}
                    className={`flex justify-between items-start py-0.5 ${
                      isLeftColumn ? "md:pr-3" : "md:pl-3"
                    }`}
                  >
                    <span
                      className="text-secondary flex-shrink-0 mr-2"
                      title={displayName}
                    >
                      {truncatedName}:
                    </span>
                    <span className="font-medium text-right break-words min-w-0">
                      {getParameterValue(key as keyof ModelParameters, value)}
                    </span>
                  </div>
                );
              };

              return (
                <>
                  <div className="space-y-0">
                    {leftColumnParams.map(([key, value]) =>
                      renderParameter([key, value], true),
                    )}
                  </div>
                  <div className="space-y-0">
                    {rightColumnParams.map(([key, value]) =>
                      renderParameter([key, value], false),
                    )}
                  </div>
                </>
              );
            })()}
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
