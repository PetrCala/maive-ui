"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import Tooltip from "@components/Tooltip";
import DownloadButton from "@components/Buttons/DownloadButton";
import TEXT from "@src/lib/text";
import { useDataStore, dataCache } from "@store/dataStore";
import {
  exportDataWithInstrumentedSE,
  downloadImageAsJpg,
} from "@utils/dataUtils";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import type { EstimateType } from "@src/types";

interface ModelResults {
  effectEstimate: number;
  standardError: number;
  isSignificant: boolean;
  andersonRubinCI: [number, number] | "NA";
  publicationBias: {
    pValue: number;
    isSignificant: boolean;
  };
  firstStageFTest: number | "NA";
  hausmanTest: {
    statistic: number;
    criticalValue: number;
    rejectsNull: boolean;
  };
  seInstrumented: number[];
  funnelPlot: string; // Base64 encoded image
  funnelPlotWidth: number;
  funnelPlotHeight: number;
}

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const results = searchParams?.get("results");
  const dataId = searchParams?.get("dataId");
  const parameters = searchParams?.get("parameters");
  const shouldDisplayAndersonRubinCI =
    parameters && JSON.parse(parameters)?.computeAndersonRubin === true;
  const estimateType =
    (parameters && JSON.parse(parameters)?.modelType) ??
    ("Unknown" as EstimateType);

  if (!results) {
    return (
      <>
        <Head>
          <title>{`${CONST.APP_DISPLAY_NAME} - Results`}</title>
        </Head>
        <main className="page-container">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">No results available</h1>
            <Link href="/upload" className="text-blue-600 hover:text-blue-700">
              Go back to upload
            </Link>
          </div>
        </main>
      </>
    );
  }

  const parsedResults: ModelResults = JSON.parse(results);

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
      let uploadedData = dataCache.get(dataId!);
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

  const handleDownloadFunnelPlot = async () => {
    try {
      const filename = `funnel_plot_${Date.now()}`;
      downloadImageAsJpg(parsedResults.funnelPlot, filename);
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
      <main className="page-container">
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
                      content={TEXT.results.effectEstimate.metrics.standardError.tooltip(
                        estimateType,
                      )}
                      visible={CONFIG.TOOLTIPS_ENABLED.RESULTS_PAGE}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {
                          TEXT.results.effectEstimate.metrics.standardError
                            .label
                        }
                      </p>
                      <p className="text-lg font-medium">
                        {parsedResults.standardError.toFixed(4)}
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
                          parsedResults.hausmanTest.rejectsNull
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {parsedResults.hausmanTest.statistic.toFixed(4)}
                        {parsedResults.hausmanTest.rejectsNull
                          ? " (Rejects Null)"
                          : " (Fails to Reject Null)"}
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
                        {parsedResults.hausmanTest.criticalValue.toFixed(4)}
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
            </div>
          </div>

          <div className="flex justify-end items-center mt-8">
            <div className="space-x-4">
              <button
                onClick={handleExportData}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Export Data with Instrumented SE
              </button>
              <button
                onClick={handleNewUpload}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Upload New Data
              </button>
              <button
                onClick={handleRerunModel}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Rerun Model
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
