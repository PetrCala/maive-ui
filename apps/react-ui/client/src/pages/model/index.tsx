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
import SectionHeading from "@src/components/SectionHeading";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import { modelService } from "@src/api/services/modelService";
import type { ModelParameters } from "@src/types";
import { modelOptionsConfig } from "@src/config/optionsConfig";
import { hasStudyIdColumn } from "@src/utils/dataUtils";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";

const isModelWeight = (weight: string): weight is ModelParameters["weight"] =>
  Object.values(CONST.WEIGHT_OPTIONS).some((option) => option.VALUE === weight);

export default function ModelPage() {
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");
  const [loading, setLoading] = useState(false);
  const [hasRunModel, setHasRunModel] = useState(false);
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [parameters, setParameters] = useState<ModelParameters>({
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
  });
  const andersonRubinUserChoiceRef = useRef<boolean>(
    CONFIG.DEFAULT_MODEL_PARAMETERS.computeAndersonRubin,
  );
  const weightUserOverrideRef = useRef(false);
  const lastInstrumentedWeightRef = useRef<ModelParameters["weight"]>(
    CONFIG.DEFAULT_MODEL_PARAMETERS.weight,
  );
  const autoSetWeightForWlsRef = useRef(false);
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
          CONFIG.SHOULD_USE_CLUSTERED_CR2_SE_AS_DEFAULT
        ) {
          setParameters((prev) => ({
            ...prev,
            includeStudyClustering: true,
            standardErrorTreatment:
              CONST.STANDARD_ERROR_TREATMENTS.CLUSTERED_CR2.VALUE,
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

      if (
        parsed.shouldUseInstrumenting === false &&
        parsed.modelType !== CONST.MODEL_TYPES.WAIVE
      ) {
        params.modelType = CONST.MODEL_TYPES
          .WLS as ModelParameters["modelType"];
      }

      if (params.modelType === CONST.MODEL_TYPES.WLS) {
        params.shouldUseInstrumenting = false;
      } else {
        params.shouldUseInstrumenting = true;
      }

      if (
        parsed.weight !== undefined &&
        parsed.weight !== CONFIG.DEFAULT_MODEL_PARAMETERS.weight
      ) {
        weightUserOverrideRef.current = true;
      }

      if (params.shouldUseInstrumenting) {
        lastInstrumentedWeightRef.current = params.weight;
      }

      setParameters(params);
      searchParamsAppliedRef.current = true;
    }
  }, [searchParams, uploadedData]); // eslint-disable-line react-hooks/exhaustive-deps

  const shouldShowAndersonRubinOption = useCallback(
    (params: ModelParameters) =>
      params.shouldUseInstrumenting &&
      params.weight === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE,
    [],
  );

  const handleParameterChange = (
    param: keyof ModelParameters,
    value: string | boolean,
  ) => {
    setParameters((prev) => {
      const wasShowingAndersonRubin = shouldShowAndersonRubinOption(prev);

      if (param === "modelType" && typeof value === "string") {
        const nextModelType = value as ModelParameters["modelType"];

        if (wasShowingAndersonRubin) {
          andersonRubinUserChoiceRef.current = prev.computeAndersonRubin;
        }

        if (prev.shouldUseInstrumenting) {
          lastInstrumentedWeightRef.current = prev.weight;
        }

        const isSwitchingFromWls = prev.modelType === CONST.MODEL_TYPES.WLS;

        if (nextModelType === CONST.MODEL_TYPES.WAIVE) {
          const restoredWeight =
            isSwitchingFromWls && autoSetWeightForWlsRef.current
              ? lastInstrumentedWeightRef.current
              : prev.weight;

          autoSetWeightForWlsRef.current = false;
          lastInstrumentedWeightRef.current = restoredWeight;

          const willShowAndersonRubin =
            restoredWeight === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE;

          return {
            ...prev,
            modelType: nextModelType,
            shouldUseInstrumenting: true,
            weight: restoredWeight,
            computeAndersonRubin: willShowAndersonRubin
              ? andersonRubinUserChoiceRef.current
              : false,
            maiveMethod: CONST.MAIVE_METHODS.PET_PEESE,
          };
        }

        if (nextModelType === CONST.MODEL_TYPES.WLS) {
          const shouldAutoSetWeight =
            !weightUserOverrideRef.current ||
            prev.weight === CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE;

          const nextWeight = shouldAutoSetWeight
            ? CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE
            : prev.weight;

          autoSetWeightForWlsRef.current = shouldAutoSetWeight;

          return {
            ...prev,
            modelType: nextModelType,
            shouldUseInstrumenting: false,
            weight: nextWeight,
            computeAndersonRubin: false,
          };
        }

        const restoredWeight =
          isSwitchingFromWls && autoSetWeightForWlsRef.current
            ? lastInstrumentedWeightRef.current
            : prev.weight;

        autoSetWeightForWlsRef.current = false;
        lastInstrumentedWeightRef.current = restoredWeight;

        const willShowAndersonRubin =
          restoredWeight === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE;

        return {
          ...prev,
          modelType: nextModelType,
          shouldUseInstrumenting: true,
          weight: restoredWeight,
          computeAndersonRubin: willShowAndersonRubin
            ? andersonRubinUserChoiceRef.current
            : false,
        };
      }

      if (param === "weight" && typeof value === "string") {
        if (!isModelWeight(value)) {
          return prev;
        }

        if (!prev.shouldUseInstrumenting) {
          autoSetWeightForWlsRef.current = false;
        }

        weightUserOverrideRef.current = true;

        const willShowAndersonRubin =
          prev.shouldUseInstrumenting &&
          value === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE;

        if (wasShowingAndersonRubin) {
          andersonRubinUserChoiceRef.current = prev.computeAndersonRubin;
        }

        if (prev.shouldUseInstrumenting) {
          lastInstrumentedWeightRef.current = value;
        }

        return {
          ...prev,
          weight: value,
          computeAndersonRubin: willShowAndersonRubin
            ? andersonRubinUserChoiceRef.current
            : false,
        };
      }

      if (param === "computeAndersonRubin" && typeof value === "boolean") {
        andersonRubinUserChoiceRef.current = value;
      }

      if (prev[param] === value) {
        return prev;
      }

      const nextState = { ...prev, [param]: value };

      if (nextState.modelType === CONST.MODEL_TYPES.WAIVE) {
        nextState.shouldUseInstrumenting = true;
        if (nextState.maiveMethod !== CONST.MAIVE_METHODS.PET_PEESE) {
          nextState.maiveMethod = CONST.MAIVE_METHODS.PET_PEESE;
        }

        const willShowAndersonRubin =
          nextState.weight === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE;
        nextState.computeAndersonRubin = willShowAndersonRubin
          ? andersonRubinUserChoiceRef.current
          : false;
      } else if (nextState.modelType === CONST.MODEL_TYPES.WLS) {
        nextState.shouldUseInstrumenting = false;
        nextState.computeAndersonRubin = false;
      }

      return nextState;
    });
  };

  const modelLoadingCopy = {
    title: "Running your analysis...",
    subtitle: "Hang tight while we process your model settings.",
  };

  useEffect(() => {
    if (parameters.modelType === CONST.MODEL_TYPES.WAIVE) {
      if (
        parameters.shouldUseInstrumenting &&
        parameters.maiveMethod === CONST.MAIVE_METHODS.PET_PEESE
      ) {
        return;
      }

      autoSetWeightForWlsRef.current = false;

      setParameters((prev) => {
        if (prev.modelType !== CONST.MODEL_TYPES.WAIVE) {
          return prev;
        }

        const willShowAndersonRubin =
          prev.weight === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE;

        return {
          ...prev,
          shouldUseInstrumenting: true,
          maiveMethod: CONST.MAIVE_METHODS.PET_PEESE,
          computeAndersonRubin: willShowAndersonRubin
            ? andersonRubinUserChoiceRef.current
            : false,
        };
      });

      return;
    }

    if (
      parameters.modelType === CONST.MODEL_TYPES.WLS &&
      parameters.shouldUseInstrumenting
    ) {
      setParameters((prev) => {
        if (prev.modelType !== CONST.MODEL_TYPES.WLS) {
          return prev;
        }

        return {
          ...prev,
          shouldUseInstrumenting: false,
          computeAndersonRubin: false,
        };
      });

      return;
    }

    if (
      parameters.modelType !== CONST.MODEL_TYPES.WLS &&
      !parameters.shouldUseInstrumenting
    ) {
      autoSetWeightForWlsRef.current = false;

      setParameters((prev) => {
        if (prev.modelType === CONST.MODEL_TYPES.WLS) {
          return prev;
        }

        const willShowAndersonRubin =
          prev.weight === CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE;

        return {
          ...prev,
          shouldUseInstrumenting: true,
          computeAndersonRubin: willShowAndersonRubin
            ? andersonRubinUserChoiceRef.current
            : false,
        };
      });
    }
  }, [parameters]);

  useEffect(() => {
    if (loading || hasRunModel) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [loading, hasRunModel]);

  const handleRunModel = useCallback(() => {
    void (async () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters.standardErrorTreatment, uploadedData]);

  useEffect(() => {
    if (
      parameters.shouldUseInstrumenting ||
      parameters.weight !== CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE
    ) {
      return;
    }

    autoSetWeightForWlsRef.current = true;

    setParameters((prev) => ({
      ...prev,
      weight: CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE,
    }));
  }, [parameters.shouldUseInstrumenting, parameters.weight]);

  useEffect(() => {
    if (parameters.shouldUseInstrumenting) {
      lastInstrumentedWeightRef.current = parameters.weight;
    }
  }, [parameters.shouldUseInstrumenting, parameters.weight]);

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Model Parameters`}</title>
      </Head>
      <main className="content-page-container">
        {!dataId ? (
          <div className="text-center min-h-[400px]">
            <SectionHeading
              level="h1"
              text="No data selected"
              className="mb-4"
            />
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
                  title={modelLoadingCopy.title}
                  subtitle={modelLoadingCopy.subtitle}
                  color="blue"
                  size="md"
                />
              ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-all duration-500 opacity-100 scale-100">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center mb-2">
                      <div className="flex-grow">
                        <SectionHeading level="h1" text="Model Parameters" />
                      </div>
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
