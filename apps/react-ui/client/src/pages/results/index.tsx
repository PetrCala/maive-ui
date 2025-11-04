"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Head from "next/head";
import Image from "next/image";
import Tooltip from "@components/Tooltip";
import DownloadButton from "@components/Buttons/DownloadButton";
import ActionButton from "@components/Buttons/ActionButton";
import { GoBackButton } from "@components/Buttons";
import SectionHeading from "@src/components/SectionHeading";
import TEXT, { getResultsText } from "@src/lib/text";
import { useDataStore, dataCache } from "@store/dataStore";
import {
  exportComprehensiveResults,
  downloadImageAsJpg,
} from "@utils/dataUtils";
import {
  deriveDataInfoFromUploadedData,
  generateDataInfo,
} from "@utils/dataInfoUtils";
import type { ModelParameters, ModelResults } from "@src/types";
import CitationBox from "@src/components/CitationBox";
import { RunInfoModal } from "@src/components/Modals";
import ResultsSummary from "@src/components/ResultsSummary";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import Alert from "@src/components/Alert";
import {
  formatFilterRowSummary,
  formatFilterSummary,
  normalizeFilterState,
} from "@src/utils/subsampleFilterUtils";
import {
  FaInfoCircle,
  FaDownload,
  FaFilter,
  FaUpload,
  FaRedo,
  FaChartLine,
  FaPlay,
  FaChevronDown,
} from "react-icons/fa";

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const results = searchParams?.get("results") ?? null;
  const dataId = searchParams?.get("dataId") ?? null;
  const parameters = searchParams?.get("parameters") ?? null;
  const runDuration = searchParams?.get("runDuration") ?? null;
  const runTimestamp = searchParams?.get("runTimestamp") ?? null;

  const [isRunInfoModalOpen, setIsRunInfoModalOpen] = useState(false);
  const [isFunnelInterpretationOpen, setIsFunnelInterpretationOpen] =
    useState(false);

  let parsedParametersJson: Partial<ModelParameters> = {};
  if (parameters) {
    try {
      const parsed = JSON.parse(parameters) as unknown;
      if (parsed && typeof parsed === "object") {
        parsedParametersJson = parsed as Partial<ModelParameters>;
      }
    } catch (error) {
      console.error("Failed to parse model parameters from URL:", error);
    }
  }

  const parsedParameters: ModelParameters = {
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
    ...parsedParametersJson,
  };

  if (
    parsedParameters.shouldUseInstrumenting === false &&
    parsedParameters.modelType !== CONST.MODEL_TYPES.WAIVE
  ) {
    parsedParameters.modelType = CONST.MODEL_TYPES.WLS;
  }

  if (parsedParameters.modelType === CONST.MODEL_TYPES.WLS) {
    parsedParameters.shouldUseInstrumenting = false;
  } else {
    parsedParameters.shouldUseInstrumenting = true;
  }

  const shouldUseInstrumenting =
    parsedParameters?.shouldUseInstrumenting ?? true;
  const isWaiveModel = parsedParameters.modelType === CONST.MODEL_TYPES.WAIVE;

  const uploadedData = useMemo(() => {
    if (!dataId) {
      return null;
    }

    let data = dataCache.get(dataId);

    if (!data) {
      const storeData = useDataStore.getState().uploadedData;
      if (storeData && storeData.id === dataId) {
        data = storeData;
        dataCache.set(dataId, data);
      }
    }

    return data ?? null;
  }, [dataId]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const normalizedFilterState = useMemo(() => {
    return normalizeFilterState(uploadedData?.subsampleFilter);
  }, [uploadedData]);

  const activeFilterSummary = useMemo(() => {
    if (!normalizedFilterState?.isEnabled) {
      return null;
    }

    const summary = formatFilterSummary(normalizedFilterState);
    return summary || null;
  }, [normalizedFilterState]);

  const activeFilterRowSummary = useMemo(() => {
    if (!normalizedFilterState?.isEnabled) {
      return null;
    }

    const rowSummary = formatFilterRowSummary(
      normalizedFilterState,
      numberFormatter,
    );

    return rowSummary || null;
  }, [normalizedFilterState, numberFormatter]);

  // Memoize dataInfo to prevent expensive recalculations on every render
  const dataInfo = useMemo(() => {
    if (uploadedData) {
      return deriveDataInfoFromUploadedData(uploadedData);
    }

    return generateDataInfo(dataId);
  }, [uploadedData, dataId]);

  const resultsText = useMemo(
    () =>
      getResultsText(
        parsedParameters.modelType,
        shouldUseInstrumenting,
        parsedParameters.standardErrorTreatment,
      ),
    [
      parsedParameters.modelType,
      shouldUseInstrumenting,
      parsedParameters.standardErrorTreatment,
    ],
  );

  const instrumentedFunnelInterpretationText =
    "The figure is a scatter plot of effect sizes against their MAIVE-adjusted precision (black-filled dots). Hollow dots denote unadjusted precision. Shaded regions represent levels of statistical significance of the reported estimates. The solid line shows the MAIVE fit, and the corrected meta-analytic estimate is given by the intercept of this line with the upper horizontal axis.";

  const nonInstrumentedFunnelInterpretationText =
    "The figure is a scatter plot of effect sizes against their precision. Shaded regions represent levels of statistical significance of the reported estimates. The solid line shows the regression fit, and the corrected meta-analytic estimate is given by the intercept of this line with the upper horizontal axis.";

  const baseFunnelInterpretationText = shouldUseInstrumenting
    ? instrumentedFunnelInterpretationText
    : nonInstrumentedFunnelInterpretationText;

  const funnelInterpretationText = isWaiveModel
    ? baseFunnelInterpretationText.replace(/MAIVE/g, "WAIVE")
    : baseFunnelInterpretationText;

  if (!results) {
    return (
      <>
        <Head>
          <title>{`${CONST.APP_DISPLAY_NAME} - Results`}</title>
        </Head>
        <main className="content-page-container">
          <div className="text-center">
            <SectionHeading
              level="h1"
              text="No results available"
              className="mb-4"
            />
            <GoBackButton
              href="/upload"
              text="Go back to upload"
              variant="simple"
            />
          </div>
        </main>
      </>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsedResults: ModelResults = JSON.parse(results ?? "{}");

  const handleRerunModel = () => {
    router.push(`/model?dataId=${dataId}&parameters=${parameters}`);
  };

  const handleNewUpload = () => {
    router.push("/upload");
  };

  const handleExportData = () => {
    if (!dataId) {
      alert("No data available for export");
      return;
    }

    try {
      // Get the original data from cache or store
      let currentData = uploadedData ?? dataCache.get(dataId);
      if (!currentData) {
        const storeData = useDataStore.getState().uploadedData;
        if (!storeData || storeData.id !== dataId) {
          alert("Original data not found. Please upload your data again.");
          return;
        }
        currentData = storeData;
        dataCache.set(dataId, currentData);
      }

      exportComprehensiveResults(
        currentData.data,
        parsedResults,
        parsedParameters,
        parsedResults.seInstrumented,
        currentData.filename,
        runDuration ? parseInt(runDuration, 10) : undefined,
        runTimestamp ? new Date(runTimestamp) : undefined,
        dataInfo,
      );
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  const handleDownloadFunnelPlot = () => {
    try {
      const filename = `funnel_plot_${Date.now()}`;
      downloadImageAsJpg(
        parsedResults.funnelPlot,
        filename,
        !!CONFIG.SHOULD_ADD_CITATION_TO_FUNNEL_PLOT,
      );
    } catch (error) {
      console.error("Error downloading funnel plot:", error);
      alert("Failed to download funnel plot. Please try again.");
    }
  };

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Results`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full space-y-8 px-2 sm:px-0">
          <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8">
            <SectionHeading level="h1" text="Model Results" className="mb-6" />

            <div className="space-y-6">
              {isWaiveModel && (
                <Alert
                  message={TEXT.waive.cautionNote}
                  type={CONST.ALERT_TYPES.WARNING}
                  className="mt-0"
                />
              )}
              {activeFilterSummary ? (
                <div className="inline-flex flex-wrap items-center gap-2 self-start rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-blue-800 dark:text-blue-200">
                  <FaFilter className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {resultsText.activeFilterLabel}:
                  </span>
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {activeFilterSummary}
                  </span>
                  {activeFilterRowSummary ? (
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-200">
                      • {activeFilterRowSummary}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {/* Results Summary */}
              <ResultsSummary
                results={parsedResults}
                parameters={parsedParameters}
                variant="detailed"
                layout="horizontal"
                runDuration={
                  runDuration ? parseInt(runDuration, 10) : undefined
                }
                runTimestamp={runTimestamp ? new Date(runTimestamp) : undefined}
                dataInfo={dataInfo}
                showTooltips={true}
                resultsText={resultsText}
              />

              {/* Funnel Plot */}
              <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 rounded-lg relative">
                <div className="flex flex-col gap-2">
                  <Tooltip
                    content={resultsText.funnelPlot.tooltip}
                    visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                  >
                    <SectionHeading
                      level="h2"
                      text={resultsText.funnelPlot.title}
                      className="mb-1"
                    />
                  </Tooltip>
                  <div className="self-start">
                    <button
                      type="button"
                      onClick={() =>
                        setIsFunnelInterpretationOpen((prev) => !prev)
                      }
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-700 rounded"
                      aria-expanded={isFunnelInterpretationOpen}
                      aria-controls="funnel-interpretation-panel"
                    >
                      Interpretation of the funnel plot
                      <FaChevronDown
                        className={`w-3 h-3 transition-transform ${
                          isFunnelInterpretationOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  {isFunnelInterpretationOpen ? (
                    <p
                      id="funnel-interpretation-panel"
                      className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                    >
                      {funnelInterpretationText}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-center">
                  <Image
                    src={parsedResults.funnelPlot}
                    alt={
                      isWaiveModel
                        ? "WAIVE-adjusted funnel plot"
                        : "MAIVE-adjusted funnel plot"
                    }
                    width={Math.min(parsedResults.funnelPlotWidth, 800)}
                    height={Math.min(parsedResults.funnelPlotHeight, 800)}
                    className="max-w-full h-auto"
                  />
                </div>
                <div className="absolute flex bottom-6 right-6 sm:bottom-8 sm:right-8">
                  <DownloadButton
                    onClick={handleDownloadFunnelPlot}
                    title="Download funnel plot as JPG"
                    className="shadow-lg"
                  />
                </div>
              </div>
              <CitationBox variant="compact" useBlueStyling />
            </div>
          </div>

          <div className="flex flex-col gap-6 mt-8 lg:flex-row">
            {/* Left Column - Current Run Actions */}
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FaChartLine className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Current Run
                </span>
              </div>
              <ActionButton
                onClick={() => setIsRunInfoModalOpen(true)}
                variant="secondary"
                size="md"
                className="inline-flex items-center gap-2 w-full"
              >
                <FaInfoCircle className="w-4 h-4" />
                Show Run Info
              </ActionButton>
              <ActionButton
                onClick={handleExportData}
                variant="purple"
                size="md"
                className="inline-flex items-center gap-2 w-full"
              >
                <FaDownload className="w-4 h-4" />
                Export Results and Adjusted SEs
              </ActionButton>
            </div>

            {/* Separator */}
            <div className="hidden lg:flex justify-center w-px">
              <div className="w-px h-32 bg-gradient-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
            </div>

            {/* Right Column - New Run Actions */}
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FaPlay className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  New Run
                </span>
              </div>
              <ActionButton
                onClick={handleNewUpload}
                variant="secondary"
                size="md"
                className="inline-flex items-center gap-2 w-full"
              >
                <FaUpload className="w-4 h-4" />
                Upload New Data
              </ActionButton>
              <ActionButton
                onClick={handleRerunModel}
                variant="primary"
                size="md"
                className="inline-flex items-center gap-2 w-full"
              >
                <FaRedo className="w-4 h-4" />
                Rerun Model
              </ActionButton>
            </div>
          </div>
        </div>
      </main>

      {/* Run Info Modal */}
      <RunInfoModal
        isOpen={isRunInfoModalOpen}
        onClose={() => setIsRunInfoModalOpen(false)}
        parameters={parsedParameters}
        results={parsedResults}
        dataInfo={dataInfo}
        runDuration={runDuration ? parseInt(runDuration, 10) : undefined}
        runTimestamp={runTimestamp ? new Date(runTimestamp) : undefined}
        onExportButtonClick={handleExportData}
        resultsText={resultsText}
      />
    </>
  );
}
