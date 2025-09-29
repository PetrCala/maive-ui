"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import { useRouter } from "next/navigation";
import { generateMockResults, shouldUseMockResults } from "@utils/mockData";
import { useDataStore, dataCache, type UploadedData } from "@store/dataStore";
import HelpButton from "@src/components/Icons/HelpIcon";
import { ParametersHelpModal } from "@src/components/Modals";
import { OptionSection } from "@src/components/Options";
import ActionButton from "@src/components/Buttons/ActionButton";
import { GoBackButton } from "@src/components/Buttons";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import LoadingCard from "@src/components/LoadingCard";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import { modelService } from "@src/api/services/modelService";
import type { ModelParameters } from "@src/types";
import { modelOptionsConfig } from "@src/config/optionsConfig";
import { hasStudyIdColumn } from "@src/utils/dataUtils";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";

export default function ModelPage() {
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");
  const [loading, setLoading] = useState(false);
  const [hasRunModel, setHasRunModel] = useState(false);
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [parameters, setParameters] = useState<ModelParameters>({
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
  });
  const previousComputeAndersonRubinRef = useRef<boolean>(
    CONFIG.DEFAULT_MODEL_PARAMETERS.computeAndersonRubin,
  );
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const searchParamsAppliedRef = useRef(false);
  const runModelButtonRef = useRef<HTMLButtonElement>(null);
  const { showAlert } = useGlobalAlert();

  useEnterKeyAction(() => {
    const button = runModelButtonRef.current;

    if (button && !button.disabled) {
      button.click();
    }
  });

  const loadDataFromStore = () => {
    try {
      // Try to get data from cache first
      let data = dataCache.get(dataId ?? "");

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

      // Only set default parameters if no search params exist
      if (!searchParams?.get("parameters")) {
        if (
          hasStudyIdColumn(data.data) &&
          CONFIG.SHOULD_USE_BOOTSTRAP_SE_AS_DEFAULT
        ) {
          setParameters((prev) => ({
            ...prev,
            includeStudyClustering: true,
            standardErrorTreatment:
              CONST.STANDARD_ERROR_TREATMENTS.BOOTSTRAP.VALUE,
          }));
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (dataId) {
      // Reset search params applied flag when navigating to different data
      searchParamsAppliedRef.current = false;
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
  }, [dataId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useMemo(() => {
    if (
      searchParams?.get("parameters") &&
      uploadedData &&
      !searchParamsAppliedRef.current
    ) {
      const parsed = JSON.parse(
        decodeURIComponent(searchParams.get("parameters") ?? "{}"),
      ) as Partial<ModelParameters>;
      const params = { ...parameters, ...parsed };
      setParameters(params);
      searchParamsAppliedRef.current = true;
    }
  }, [searchParams, uploadedData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleParameterChange = (
    param: keyof ModelParameters,
    value: string | boolean,
  ) => {
    setParameters((prev) => {
      if (param === "shouldUseInstrumenting" && typeof value === "boolean") {
        if (!value) {
          previousComputeAndersonRubinRef.current = prev.computeAndersonRubin;

          if (prev.computeAndersonRubin === false) {
            return { ...prev, shouldUseInstrumenting: value };
          }

          return {
            ...prev,
            shouldUseInstrumenting: value,
            computeAndersonRubin: false,
          };
        }

        const restoredValue =
          previousComputeAndersonRubinRef.current ?? prev.computeAndersonRubin;
        return {
          ...prev,
          shouldUseInstrumenting: value,
          computeAndersonRubin: restoredValue,
        };
      }

      if (param === "computeAndersonRubin" && typeof value === "boolean") {
        previousComputeAndersonRubinRef.current = value;
      }

      if (prev[param] === value) {
        return prev;
      }

      return { ...prev, [param]: value };
    });
  };

  useEffect(() => {
    if (parameters.shouldUseInstrumenting) {
      previousComputeAndersonRubinRef.current = parameters.computeAndersonRubin;
    }
  }, [parameters.shouldUseInstrumenting, parameters.computeAndersonRubin]);

  useEffect(() => {
    if (
      parameters.shouldUseInstrumenting ||
      parameters.computeAndersonRubin === false
    ) {
      return;
    }
    previousComputeAndersonRubinRef.current = parameters.computeAndersonRubin;
    setParameters((prev) => ({
      ...prev,
      computeAndersonRubin: false,
    }));
  }, [parameters.shouldUseInstrumenting, parameters.computeAndersonRubin]);

  const handleRunModel = useCallback(() => {
    void (async () => {
      window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top of page
      setLoading(true);
      setHasRunModel(true);
      abortControllerRef.current = new AbortController();

      const startTime = Date.now();
      const runTimestamp = new Date();

      try {
        let result: { data?: unknown; error?: string; message?: string };

        if (shouldUseMockResults()) {
          // Use mock data in development mode
          console.debug("Generating mock results in development mode");
          const nrow = uploadedData?.data.length ?? 0;
          result = {
            data: generateMockResults(nrow, parameters.useLogFirstStage),
          };
        } else {
          // This is a client-side call to the server-side API
          // For server-side, use the runModelClient function
          result = await modelService.runModel(
            uploadedData?.data ?? [],
            parameters,
            abortControllerRef.current,
          );
        }

        if (result.error) {
          throw new Error(result?.message ?? "Failed to run model");
        }

        const endTime = Date.now();
        const runDuration = endTime - startTime;

        // Redirect to results page with the model output
        const results = result.data;
        const urlSearchParams = new URLSearchParams({
          results: JSON.stringify(results),
          dataId: dataId ?? "",
          parameters: JSON.stringify(parameters),
          runDuration: runDuration.toString(),
          runTimestamp: runTimestamp.toISOString(),
        });
        if (isMountedRef.current) {
          router.push(`/results?${urlSearchParams.toString()}`);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
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
    })();
  }, [dataId, parameters, uploadedData, router, showAlert]);

  useEffect(() => {
    if (!uploadedData || !hasStudyIdColumn(uploadedData.data)) {
      return;
    }

    // When the user sets the SE treatment value to 'not clustered', we want to match the value of the 'include study clustering' option for backend compatibility
    handleParameterChange(
      "includeStudyClustering",
      parameters.standardErrorTreatment !==
        CONST.STANDARD_ERROR_TREATMENTS.NOT_CLUSTERED.VALUE,
    );
  }, [parameters.standardErrorTreatment, uploadedData]);

  useEffect(() => {
    if (
      parameters.shouldUseInstrumenting ||
      parameters.weight !== CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE
    ) {
      return;
    }

    setParameters((prev) => ({
      ...prev,
      weight: CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE,
    }));
  }, [parameters.shouldUseInstrumenting, parameters.weight]);

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
                <LoadingCard
                  title={`Running ${parameters.modelType}... Please wait.`}
                  color="blue"
                  size="md"
                />
              ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-500 opacity-100 scale-100">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center mb-2">
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex-grow">
                        Model Parameters
                      </h1>
                      {CONFIG.SHOULD_SHOW_MODEL_PARAMS_HELP_MODAL && (
                        <HelpButton modalComponent={ParametersHelpModal} />
                      )}
                    </div>
                    <div className="mb-2">
                      <p className="text-gray-700 dark:text-gray-300">
                        Please select the model type and parameters you would
                        like to use.
                      </p>
                    </div>
                    <div className="space-y-6">
                      <OptionSection
                        config={modelOptionsConfig.basic}
                        parameters={parameters}
                        onChange={handleParameterChange}
                        context={{ uploadedData }}
                      />

                      <OptionSection
                        config={modelOptionsConfig.advanced}
                        parameters={parameters}
                        onChange={handleParameterChange}
                        context={{ uploadedData }}
                      />

                      <ActionButton
                        ref={runModelButtonRef}
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
