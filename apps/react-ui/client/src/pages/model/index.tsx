"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import { useRouter } from "next/navigation";
import { generateMockResults, shouldUseMockResults } from "@utils/mockData";
import { useDataStore, dataCache } from "@store/dataStore";
import HelpButton from "@src/components/Icons/HelpIcon";
import Alert from "@src/components/Alert";
import AdvancedOptions from "@src/components/Model/AdvancedOptions";
import ParametersHelpModal from "@src/components/Model/ParametersHelpModal";
import { YesNoSelect, DropdownSelect } from "@src/components/Options";
import ActionButton from "@src/components/Buttons/ActionButton";
import { GoBackButton } from "@src/components/Buttons";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import Tooltip from "@src/components/Tooltip";
import { getRApiUrl, httpPost } from "@src/api";
import type { ModelParameters, ModelResponse } from "@src/types";

export default function ModelPage() {
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");
  const [loading, setLoading] = useState(false);
  const [hasRunModel, setHasRunModel] = useState(false);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [parameters, setParameters] = useState<ModelParameters>({
    modelType: CONST.MODEL_TYPES.MAIVE,
    includeStudyDummies: false,
    includeStudyClustering: false,
    standardErrorTreatment: CONST.STANDARD_ERROR_TREATMENTS.NOT_CLUSTERED.VALUE,
    computeAndersonRubin: false,
    maiveMethod: CONST.MAIVE_METHODS.PET_PEESE,
    weight: CONST.WEIGHT_OPTIONS.NO_WEIGHTS.VALUE,
    shouldUseInstrumenting: true,
  });
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const { showAlert } = useGlobalAlert();

  useEffect(() => {
    isMountedRef.current = true;
    if (dataId) {
      loadDataFromStore();
    } else {
      showAlert("No data selected", "error");
      router.push("/upload");
    }
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [dataId]); // eslint-disable-line react-hooks/exhaustive-deps

  useMemo(() => {
    if (searchParams?.get("parameters")) {
      const parsed = JSON.parse(
        decodeURIComponent(searchParams.get("parameters") || "{}"),
      ) as Partial<ModelParameters>;
      const params = { ...parameters, ...parsed };
      setParameters(params);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDataFromStore = () => {
    try {
      // Try to get data from cache first
      let data = dataCache.get(dataId!);

      // If not in cache, try to get from store
      if (!data) {
        const storeData = useDataStore.getState().uploadedData;
        if (storeData && storeData.id === dataId) {
          data = storeData;
          // Also put it back in cache
          dataCache.set(dataId, data);
        }
      }

      if (!data) {
        throw new Error("Data not found");
      }

      setUploadedData(data);

      // Check if studyID column exists and update standard error treatment accordingly
      const headers = Object.keys(data.data[0] || {});
      const hasStudyID = headers.some((header: string) =>
        /\bstudy[\s_-]?id\b/i.test(header),
      );
      if (hasStudyID) {
        setParameters((prev) => ({
          ...prev,
          standardErrorTreatment: "bootstrap",
        }));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleParameterChange = (
    param: keyof ModelParameters,
    value: string | boolean,
  ) => {
    setParameters((prev) => ({ ...prev, [param]: value }));
  };

  const handleRunModel = async () => {
    window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top of page
    setLoading(true);
    setHasRunModel(true);
    abortControllerRef.current = new AbortController();
    try {
      let result: { data?: any; error?: any; message?: string };

      if (shouldUseMockResults()) {
        // Use mock data in development mode
        console.debug("Generating mock results in development mode");
        const nrow = uploadedData.data.length;
        result = { data: generateMockResults(nrow) };
      } else {
        result = await httpPost<ModelResponse>(
          `${getRApiUrl()}/run-model`,
          {
            data: JSON.stringify(uploadedData.data),
            parameters: JSON.stringify(parameters),
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            signal: abortControllerRef.current?.signal,
          },
        );
      }

      if (result.error) {
        throw new Error(result?.message || "Failed to run model");
      }

      // Redirect to results page with the model output
      const results = result.data;
      const searchParams = new URLSearchParams({
        results: JSON.stringify(results),
        dataId: dataId || "",
        parameters: JSON.stringify(parameters),
      });
      if (isMountedRef.current) {
        router.push(`/results?${searchParams.toString()}`);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Model run aborted due to navigation or unmount.");
        showAlert("Model run was aborted.", "warning");
        setLoading(false);
        setHasRunModel(false);
        return;
      }
      console.error("Error running model:", error);
      if (isMountedRef.current) {
        const msg =
          "An error occurred while running the model: " +
          (error instanceof Error ? error.message : String(error));
        showAlert(msg, "error");
        setLoading(false);
        setHasRunModel(false);
      }
    } finally {
      if (isMountedRef.current) {
        // Only set loading to false if there was an error or abort
        // Otherwise, navigation will occur and component will unmount
      }
      abortControllerRef.current = null;
    }
  };

  const LoadingCard = () => (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col items-center w-full max-h-[90vh] overflow-y-auto transition-all duration-500 opacity-100 scale-100">
      <svg
        className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400 mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
      <span className="text-lg font-medium text-gray-700 dark:text-gray-200">
        Running {parameters.modelType}... Please wait.
      </span>
    </div>
  );

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Model Parameters`}</title>
      </Head>
      <main className="content-page-container">
        {!dataId ? (
          <div className="text-center min-h-[400px]">
            <h1 className="text-2xl font-bold mb-4">No data selected</h1>
            <GoBackButton
              href="/upload"
              text="Go back to upload"
              variant="simple"
            />
          </div>
        ) : (
          <div className="max-w-4xl w-full">
            <GoBackButton
              href={`/validation?dataId=${dataId}`}
              text="Back to Validation"
            />

            {/* Card transition: parameters or loading */}
            <div className="min-h-[400px] w-full items-center justify-center">
              {loading || hasRunModel ? (
                <LoadingCard />
              ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-500 opacity-100 scale-100">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center mb-3">
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex-grow">
                        Model Parameters
                      </h1>
                      {CONFIG.SHOULD_SHOW_MODEL_PARAMS_HELP_MODAL && (
                        <HelpButton modalComponent={ParametersHelpModal} />
                      )}
                    </div>
                    <div className="mb-3">
                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                        Please select the model type and parameters you would
                        like to use.
                      </p>
                    </div>
                    <div className="space-y-6">
                      <div className="flex flex-col gap-6">
                        <div className="flex-shrink-0">
                          <Tooltip
                            content={TEXT.model.modelType.tooltip}
                            visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
                          >
                            {CONFIG.WAIVE_ENABLED ? (
                              <DropdownSelect
                                label={TEXT.model.modelType.label}
                                value={parameters.modelType}
                                onChange={(value) =>
                                  handleParameterChange("modelType", value)
                                }
                                options={Object.values(CONST.MODEL_TYPES).map(
                                  (type) => ({
                                    value: type,
                                    label: type,
                                  }),
                                )}
                              />
                            ) : (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {TEXT.model.modelType.label}
                                </label>
                                <p>{parameters.modelType}</p>
                              </div>
                            )}
                          </Tooltip>
                        </div>
                        <div className="flex-shrink-0">
                          <Tooltip
                            content={TEXT.model.includeStudyDummies.tooltip}
                            visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
                          >
                            <YesNoSelect
                              label={TEXT.model.includeStudyDummies.label}
                              value={parameters.includeStudyDummies}
                              onChange={(value) =>
                                handleParameterChange(
                                  "includeStudyDummies",
                                  value,
                                )
                              }
                            />
                          </Tooltip>
                        </div>
                        <div className="flex-shrink-0">
                          <Tooltip
                            content={TEXT.model.includeStudyClustering.tooltip}
                            visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
                          >
                            <YesNoSelect
                              label={TEXT.model.includeStudyClustering.label}
                              value={parameters.includeStudyClustering}
                              onChange={(value) =>
                                handleParameterChange(
                                  "includeStudyClustering",
                                  value,
                                )
                              }
                            />
                          </Tooltip>
                        </div>
                        <div className="flex-shrink-0">
                          <Tooltip
                            content={TEXT.model.standardErrorTreatment.tooltip}
                            visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
                          >
                            <DropdownSelect
                              label={TEXT.model.standardErrorTreatment.label}
                              value={parameters.standardErrorTreatment}
                              onChange={(value) =>
                                handleParameterChange(
                                  "standardErrorTreatment",
                                  value,
                                )
                              }
                              options={Object.values(
                                CONST.STANDARD_ERROR_TREATMENTS,
                              ).map((treatment) => ({
                                value: treatment.VALUE,
                                label: treatment.TEXT,
                              }))}
                            />
                          </Tooltip>
                        </div>
                        <div className="flex-shrink-0">
                          <Tooltip
                            content={TEXT.model.weight.tooltip}
                            visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
                          >
                            <DropdownSelect
                              label={TEXT.model.weight.label}
                              value={parameters.weight}
                              onChange={(value) =>
                                handleParameterChange("weight", value)
                              }
                              options={Object.values(CONST.WEIGHT_OPTIONS).map(
                                (option) => ({
                                  value: option.VALUE,
                                  label: option.TEXT,
                                }),
                              )}
                            />
                          </Tooltip>
                        </div>
                        <div className="flex-shrink-0">
                          <Tooltip
                            content={TEXT.model.computeAndersonRubin.tooltip}
                            visible={CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
                          >
                            <YesNoSelect
                              label={TEXT.model.computeAndersonRubin.label}
                              value={parameters.computeAndersonRubin}
                              onChange={(value) =>
                                handleParameterChange(
                                  "computeAndersonRubin",
                                  value,
                                )
                              }
                            />
                          </Tooltip>
                          {parameters.computeAndersonRubin && (
                            <Alert
                              message={TEXT.model.computeAndersonRubin.warning}
                              type="warning"
                              className="mt-3"
                            />
                          )}
                        </div>
                      </div>
                      <AdvancedOptions
                        maiveMethod={parameters.maiveMethod}
                        shouldUseInstrumenting={
                          parameters.shouldUseInstrumenting
                        }
                        handleParameterChange={handleParameterChange}
                      />
                      <ActionButton
                        onClick={handleRunModel}
                        variant="primary"
                        className="w-full"
                      >
                        {TEXT.model.runModel}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
