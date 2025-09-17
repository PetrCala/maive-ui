"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Head from "next/head";
import Image from "next/image";
import Tooltip from "@components/Tooltip";
import DownloadButton from "@components/Buttons/DownloadButton";
import ActionButton from "@components/Buttons/ActionButton";
import { GoBackButton } from "@components/Buttons";
import { getResultsText } from "@src/lib/text";
import { useDataStore, dataCache } from "@store/dataStore";
import {
  exportComprehensiveResults,
  downloadImageAsJpg,
} from "@utils/dataUtils";
import { generateDataInfo } from "@utils/dataInfoUtils";
import type { ModelParameters, ModelResults } from "@src/types";
import CitationBox from "@src/components/CitationBox";
import { RunInfoModal } from "@src/components/Modals";
import ResultsSummary from "@src/components/ResultsSummary";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import {
  FaInfoCircle,
  FaDownload,
  FaUpload,
  FaRedo,
  FaChartLine,
  FaPlay,
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsedParameters: ModelParameters = JSON.parse(parameters ?? "{}");

  const shouldUseInstrumenting =
    parsedParameters?.shouldUseInstrumenting ?? true;

  // Memoize dataInfo to prevent expensive recalculations on every render
  const dataInfo = useMemo(() => generateDataInfo(dataId), [dataId]);

  const resultsText = useMemo(
    () => getResultsText(shouldUseInstrumenting),
    [shouldUseInstrumenting],
  );

  if (!results) {
    return (
      <>
        <Head>
          <title>{`${CONST.APP_DISPLAY_NAME} - Results`}</title>
        </Head>
        <main className="content-page-container">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">No results available</h1>
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
      let uploadedData = dataCache.get(dataId);
      if (!uploadedData) {
        const storeData = useDataStore.getState().uploadedData;
        if (!storeData || storeData.id !== dataId) {
          alert("Original data not found. Please upload your data again.");
          return;
        }
        uploadedData = storeData;
      }

      exportComprehensiveResults(
        uploadedData.data,
        parsedResults,
        parsedParameters,
        parsedResults.seInstrumented,
        uploadedData.filename,
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-white">
              Model Results
            </h1>

            <div className="space-y-6">
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
                <Tooltip
                  content={resultsText.funnelPlot.tooltip}
                  visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                >
                  <h2 className="text-xl font-semibold mb-4">
                    {resultsText.funnelPlot.title}
                  </h2>
                </Tooltip>
                <div className="flex justify-center">
                  <Image
                    src={parsedResults.funnelPlot}
                    alt="Funnel Plot"
                    width={Math.min(parsedResults.funnelPlotWidth, 800)}
                    height={Math.min(parsedResults.funnelPlotHeight, 800)}
                    className="max-w-full h-auto"
                  />
                </div>
                <div className="absolute flex bottom-4 right-4 sm:bottom-6 sm:right-6">
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
