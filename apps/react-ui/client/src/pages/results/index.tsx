"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Tooltip from "@components/Tooltip";
import DownloadButton from "@components/Buttons/DownloadButton";
import ActionButton from "@components/Buttons/ActionButton";
import { GoBackButton } from "@components/Buttons";
import TEXT from "@src/lib/text";
import { useDataStore, dataCache } from "@store/dataStore";
import {
  exportComprehensiveResults,
  downloadImageAsJpg,
  hasStudyIdColumn,
} from "@utils/dataUtils";
import type { ModelParameters, ModelResults } from "@src/types";
import CitationBox from "@src/components/CitationBox";
import { RunInfoModal } from "@src/components/Modals";
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
  const shouldDisplayAndersonRubinCI =
    parsedParameters?.computeAndersonRubin === true;
  const shouldDisplayHausmanTest =
    parsedParameters?.shouldUseInstrumenting === true;
  const estimateType = parsedParameters.modelType ?? "Unknown";

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
  const shouldDisplayBootstrap =
    CONFIG.BOOTSTRAP_ENABLED &&
    parsedParameters.standardErrorTreatment ===
      CONST.STANDARD_ERROR_TREATMENTS.BOOTSTRAP.VALUE;

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

      const dataInfo = {
        filename: uploadedData.filename,
        rowCount: uploadedData.data.length,
        hasStudyId: hasStudyIdColumn(uploadedData.data),
      };

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
        <div className="max-w-4xl w-full space-y-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
              Model Results
            </h1>

            <div className="space-y-6">
              {/* Effect Estimate Section */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">
                  {TEXT.results.effectEstimate.title}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Tooltip
                      content={TEXT.results.effectEstimate.metrics.estimate.tooltip(
                        estimateType,
                      )}
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {TEXT.results.effectEstimate.metrics.estimate.label}
                      </p>
                      <p className="text-lg font-medium">
                        {parsedResults.effectEstimate.toFixed(4)}
                      </p>
                    </Tooltip>
                  </div>
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.effectEstimate.metrics.standardError
                          .tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {
                          TEXT.results.effectEstimate.metrics.standardError
                            .label
                        }
                      </p>
                      <p className="text-lg font-medium">
                        {shouldDisplayBootstrap && parsedResults.bootSE !== "NA"
                          ? parsedResults.bootSE[0]?.toFixed(4)
                          : parsedResults.standardError.toFixed(4)}
                      </p>
                    </Tooltip>
                  </div>
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.effectEstimate.metrics.significance.tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {TEXT.results.effectEstimate.metrics.significance.label}
                      </p>
                      <p
                        className={`text-lg font-medium ${
                          parsedResults.isSignificant
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {parsedResults.isSignificant ? "Yes" : "No"}
                      </p>
                    </Tooltip>
                  </div>
                  {!!shouldDisplayAndersonRubinCI && (
                    <div>
                      <Tooltip
                        content={
                          TEXT.results.effectEstimate.metrics.andersonRubinCI
                            .tooltip
                        }
                        visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                      >
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {
                            TEXT.results.effectEstimate.metrics.andersonRubinCI
                              .label
                          }
                        </p>
                        <p className="text-lg font-medium">
                          {typeof parsedResults.andersonRubinCI === "object"
                            ? `[${parsedResults.andersonRubinCI[0].toFixed(
                                4,
                              )}, ${parsedResults.andersonRubinCI[1].toFixed(4)}]`
                            : "NA"}
                        </p>
                      </Tooltip>
                    </div>
                  )}
                  {shouldDisplayBootstrap && parsedResults.bootCI !== "NA" && (
                    <div>
                      <Tooltip
                        content={
                          TEXT.results.effectEstimate.metrics.bootCI.tooltip
                        }
                        visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                      >
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {TEXT.results.effectEstimate.metrics.bootCI.label}
                        </p>
                        <p className="text-lg font-medium">
                          {typeof parsedResults.bootCI === "object"
                            ? // Show the first CI -> matches the R package SE behavior
                              `[${parsedResults.bootCI[0][0].toFixed(
                                4,
                              )}, ${parsedResults.bootCI[0][1].toFixed(4)}]`
                            : "NA"}
                        </p>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>

              {/* Publication Bias Section */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">
                  {TEXT.results.publicationBias.title}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.publicationBias.metrics.pValue.tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {TEXT.results.publicationBias.metrics.pValue.label}
                      </p>
                      <p className="text-lg font-medium">
                        {parsedResults.publicationBias.pValue.toFixed(4)}
                      </p>
                    </Tooltip>
                  </div>
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.publicationBias.metrics.significance
                          .tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {
                          TEXT.results.publicationBias.metrics.significance
                            .label
                        }
                      </p>
                      <p
                        className={`text-lg font-medium ${
                          parsedResults.publicationBias.isSignificant
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {parsedResults.publicationBias.isSignificant
                          ? "Yes"
                          : "No"}
                      </p>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Tests Section */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">
                  {TEXT.results.diagnosticTests.title}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.diagnosticTests.metrics.hausmanTest.tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {TEXT.results.diagnosticTests.metrics.hausmanTest.label}
                      </p>
                      <p
                        className={`text-lg font-medium ${
                          shouldDisplayHausmanTest
                            ? parsedResults.hausmanTest.rejectsNull
                              ? "text-green-600"
                              : "text-red-600"
                            : ""
                        }`}
                      >
                        {shouldDisplayHausmanTest
                          ? parsedResults.hausmanTest.statistic.toFixed(4)
                          : "NA"}
                        {shouldDisplayHausmanTest
                          ? parsedResults.hausmanTest.rejectsNull
                            ? " (Rejects Null)"
                            : " (Fails to Reject Null)"
                          : ""}
                      </p>
                    </Tooltip>
                  </div>
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.diagnosticTests.metrics
                          .hausmanCriticalValue.tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {
                          TEXT.results.diagnosticTests.metrics
                            .hausmanCriticalValue.label
                        }
                      </p>
                      <p className="text-lg font-medium">
                        {shouldDisplayHausmanTest
                          ? parsedResults.hausmanTest.criticalValue.toFixed(4)
                          : "-"}
                      </p>
                    </Tooltip>
                  </div>
                  <div>
                    <Tooltip
                      content={
                        TEXT.results.diagnosticTests.metrics.firstStageFTest
                          .tooltip
                      }
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {
                          TEXT.results.diagnosticTests.metrics.firstStageFTest
                            .label
                        }
                      </p>
                      {parsedResults.firstStageFTest === "NA" ? (
                        <p className="text-lg font-medium">NA</p>
                      ) : (
                        <p
                          className={`text-lg font-medium ${
                            parsedResults.firstStageFTest >= 10
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {parsedResults.firstStageFTest.toFixed(4)}
                          {parsedResults.firstStageFTest > 10 && " (Strong)"}
                        </p>
                      )}
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Funnel Plot */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg relative">
                <Tooltip
                  content={TEXT.results.funnelPlot.tooltip}
                  visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                >
                  <h2 className="text-xl font-semibold mb-4">
                    {TEXT.results.funnelPlot.title}
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
                <div className="absolute flex bottom-8 right-8">
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

          <div className="flex gap-4 mt-8">
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
            <div className="flex justify-center w-px">
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
        dataInfo={
          dataId
            ? {
                filename: dataCache.get(dataId)?.filename ?? "Unknown",
                rowCount: dataCache.get(dataId)?.data.length ?? 0,
                hasStudyId: (() => {
                  const data = dataCache.get(dataId);
                  return data ? hasStudyIdColumn(data.data) : false;
                })(),
              }
            : undefined
        }
        runDuration={runDuration ? parseInt(runDuration, 10) : undefined}
        runTimestamp={runTimestamp ? new Date(runTimestamp) : undefined}
      />
    </>
  );
}
