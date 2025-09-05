"use client";

import { useState, useEffect } from "react";
import type { ModelParameters, ModelResults } from "@src/types";
import CONST from "@src/CONST";

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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow for smooth animation
      const timer = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

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
    const displayNames: Record<keyof ModelParameters, string> = {
      modelType: "Model Type",
      includeStudyDummies: "Include Study Dummies",
      includeStudyClustering: "Include Study Clustering",
      standardErrorTreatment: "Standard Error Treatment",
      computeAndersonRubin: "Compute Anderson-Rubin CI",
      maiveMethod: "MAIVE Method",
      weight: "Weighting",
      shouldUseInstrumenting: "Use Instrumenting",
    };
    return displayNames[key];
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
    <div
      className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50"
      onClick={handleOverlayClick}
    >
      <div
        className="modal-content max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={handleModalContentClick}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-primary">
          <h2 className="text-2xl font-bold text-primary">Run Information</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-secondary transition-colors interactive"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
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
                  <div className="flex justify-between">
                    <span className="text-secondary">Has Study ID:</span>
                    <span className="font-medium">
                      {dataInfo.hasStudyId ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Model Parameters */}
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3">
              Model Parameters
            </h3>
            <div className="space-y-3">
              {Object.entries(parameters).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center py-2 border-b border-gray-100"
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
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
