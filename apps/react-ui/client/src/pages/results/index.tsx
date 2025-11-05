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
import type { DataArray } from "@src/types/data";
import type { VersionInfo } from "@src/types/reproducibility";
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
  generateReproducibleBundle,
  getReproducibilityPackageFilename,
  validateExportData,
} from "@utils/exportReproducibleBundle";
import { saveAs } from "file-saver";
import {
  FaChevronDown,
  FaInfoCircle,
  FaDownload,
  FaFilter,
  FaUpload,
  FaRedo,
  FaChartLine,
  FaPlay,
  FaCode,
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
  const [isExportingReproducibility, setIsExportingReproducibility] =
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

  const funnelInterpretationText = useMemo(
    () =>
      shouldUseInstrumenting
        ? "The figure is a scatter plot of effect sizes against their MAIVE-adjusted precision (black-filled dots). Hollow dots denote unadjusted precision. Shaded regions represent levels of statistical significance of the reported estimates. The solid line shows the MAIVE fit, and the corrected meta-analytic estimate is given by the intercept of this line with the upper horizontal axis."
        : "The figure is a scatter plot of effect sizes against their precision. Shaded regions represent levels of statistical significance of the reported estimates. The solid line shows the regression fit, and the corrected meta-analytic estimate is given by the intercept of this line with the upper horizontal axis.",
    [shouldUseInstrumenting],
  );

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

  const handleExportReproducibility = async () => {
    setIsExportingReproducibility(true);

    try {
      // 1. Get the original data from sessionStorage, cache, or store
      let originalData: DataArray | null = null;

      // Try sessionStorage first (most reliable for export)
      try {
        const storedData = sessionStorage.getItem(`maive-data-${dataId}`);
        if (storedData) {
          originalData = JSON.parse(storedData) as DataArray;
          console.log("Retrieved data from sessionStorage");
        }
      } catch (sessionError: unknown) {
        console.warn("Failed to retrieve from sessionStorage:", sessionError);
      }

      // Fallback to dataCache or store
      if (!originalData) {
        const currentData = uploadedData ?? dataCache.get(dataId);
        if (currentData) {
          originalData = currentData.data;
          console.log("Retrieved data from cache/store");
        } else {
          const storeData = useDataStore.getState().uploadedData;
          if (storeData?.id === dataId) {
            originalData = storeData.data;
            console.log("Retrieved data from Zustand store");
          }
        }
      }

      // 2. Validate we have all required data
      validateExportData(originalData, parsedParameters, parsedResults);

      // 3. Fetch version information
      console.log("Fetching version information...");
      const versionResponse = await fetch("/api/get-version-info");
      if (!versionResponse.ok) {
        throw new Error("Failed to fetch version information");
      }
      const versionInfo = (await versionResponse.json()) as VersionInfo;

      // 4. Generate reproducibility bundle
      console.log("Generating reproducibility package...");
      if (!originalData) {
        throw new Error("Data validation passed but data is still null");
      }
      const blob = await generateReproducibleBundle(
        originalData,
        parsedParameters,
        parsedResults,
        versionInfo,
        undefined, // TODO: Add winsorization info if available
      );

      // 5. Trigger download
      const filename = getReproducibilityPackageFilename();
      saveAs(blob, filename);

      console.log(`Successfully generated and downloaded: ${filename}`);
      alert(
        "Reproducibility package downloaded! Extract the ZIP file and run 'run_analysis.R' in R to reproduce these results.",
      );
    } catch (error) {
      console.error("Error exporting reproducibility package:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to export reproducibility package: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
      );
    } finally {
      setIsExportingReproducibility(false);
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <Tooltip
                    content={resultsText.funnelPlot.tooltip}
                    visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                  >
                    <SectionHeading
                      level="h2"
                      text={resultsText.funnelPlot.title}
                      className="leading-tight"
                    />
                  </Tooltip>
                  <div className="flex items-start">
                    <button
                      type="button"
                      onClick={() =>
                        setIsFunnelInterpretationOpen((prevState) => !prevState)
                      }
                      aria-expanded={isFunnelInterpretationOpen}
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:text-blue-200 dark:hover:text-blue-100 dark:focus-visible:ring-offset-gray-700"
                    >
                      <span>Interpretation of the funnel plot</span>
                      <FaChevronDown
                        className={`h-3 w-3 transition-transform ${
                          isFunnelInterpretationOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
                {isFunnelInterpretationOpen ? (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-white/80 p-3 text-sm text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-200">
                    {funnelInterpretationText}
                  </div>
                ) : null}
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
              <ActionButton
                onClick={() => {
                  void handleExportReproducibility();
                }}
                variant="secondary"
                size="md"
                className="inline-flex items-center gap-2 w-full"
                disabled={isExportingReproducibility}
              >
                {isExportingReproducibility ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Generating Package...
                  </>
                ) : (
                  <>
                    <FaCode className="w-4 h-4" />
                    Export R Code
                  </>
                )}
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
