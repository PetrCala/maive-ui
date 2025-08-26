"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Head from "next/head";
import Image from "next/image";
import Tooltip from "@components/Tooltip";
import DownloadButton from "@components/Buttons/DownloadButton";
import ActionButton from "@components/Buttons/ActionButton";
import { GoBackButton } from "@components/Buttons";
import TEXT from "@src/lib/text";
import { useDataStore, dataCache } from "@store/dataStore";
import {
  exportDataWithInstrumentedSE,
  downloadImageAsJpg,
} from "@utils/dataUtils";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import type { ModelParameters, ModelResults } from "@src/types";
import CitationBox from "@src/components/CitationBox";

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const results = searchParams?.get("results") ?? null;
  const dataId = searchParams?.get("dataId") ?? null;
  const parameters = searchParams?.get("parameters") ?? null;

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

      // Export the data with instrumented standard errors
      exportDataWithInstrumentedSE(
        uploadedData.data,
        parsedResults.seInstrumented,
        uploadedData.filename,
        true,
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
              <CitationBox variant="compact" />
            </div>
          </div>

          <div className="flex justify-end items-center mt-8">
            <div className="space-x-4">
              <ActionButton onClick={handleExportData} variant="success">
                Export Data with Instrumented SE
              </ActionButton>
              <ActionButton onClick={handleNewUpload} variant="secondary">
                Upload New Data
              </ActionButton>
              <ActionButton onClick={handleRerunModel} variant="primary">
                Rerun Model
              </ActionButton>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
