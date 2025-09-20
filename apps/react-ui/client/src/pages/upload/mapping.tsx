"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter, useSearchParams } from "next/navigation";
import { GoBackButton } from "@src/components/Buttons";
import ActionButton from "@src/components/Buttons/ActionButton";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import { DataProcessingService } from "@src/services/dataProcessingService";
import { dataCache, useDataStore } from "@store/dataStore";
import type { ColumnMapping, UploadedData } from "@store/dataStore";
import { parseLocalizedNumber } from "@utils/dataUtils";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";

const REQUIRED_FIELDS: Array<keyof ColumnMapping> = ["effect", "se", "nObs"];
type MappingState = {
  effect: string | null;
  se: string | null;
  nObs: string | null;
  studyId: string | null;
};

const INITIAL_MAPPING: MappingState = {
  effect: null,
  se: null,
  nObs: null,
  studyId: null,
};

const NORMALIZATION_RULES: Record<keyof MappingState, RegExp[]> = {
  effect: [/^effect$/, /^effect[_\s-]?size$/, /^estimate$/, /coef/, /beta/],
  se: [/^se$/, /standard[_\s-]?error/, /^stderr$/, /^std[_\s-]?err/],
  nObs: [/^n$/, /^n[_\s-]?obs$/, /^n[_\s-]?size$/, /sample/, /participants/],
  studyId: [/study/, /id$/],
};

const normalizeColumnName = (name: string): string => {
  return name.trim().toLowerCase();
};

const autoMapColumns = (columns: string[]): MappingState => {
  const usedColumns = new Set<string>();
  const mapping: MappingState = { ...INITIAL_MAPPING };

  (Object.keys(NORMALIZATION_RULES) as Array<keyof MappingState>).forEach(
    (field) => {
      NORMALIZATION_RULES[field].some((pattern) => {
        const match = columns.find((column) => {
          if (usedColumns.has(column)) {
            return false;
          }

          const normalized = normalizeColumnName(column);
          return pattern.test(normalized);
        });

        if (match) {
          mapping[field] = match;
          usedColumns.add(match);
          return true;
        }

        return false;
      });
    },
  );

  return mapping;
};

const convertToNormalizedRow = (
  row: Record<string, unknown>,
  mapping: MappingState,
): Record<string, unknown> => {
  const getValue = (column: string | null) => {
    if (!column) {
      return null;
    }

    const rawValue = row[column];

    if (rawValue === undefined || rawValue === null) {
      return null;
    }

    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      return trimmed === "" ? null : trimmed;
    }

    return rawValue;
  };

  const normalizeNumericValue = (column: string | null) => {
    const value = getValue(column);
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = parseLocalizedNumber(value);
    return parsed ?? Number.NaN;
  };

  const normalized: Record<string, unknown> = {
    effect: normalizeNumericValue(mapping.effect),
    se: normalizeNumericValue(mapping.se),
    n_obs: normalizeNumericValue(mapping.nObs),
  };

  if (mapping.studyId) {
    normalized.study_id = getValue(mapping.studyId);
  }

  return normalized;
};

export default function ColumnMappingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");
  const { showAlert } = useGlobalAlert();

  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [mapping, setMapping] = useState<MappingState>(INITIAL_MAPPING);
  const [autoMappingApplied, setAutoMappingApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEnterKeyAction(() => {
    const button = continueButtonRef.current;

    if (button && !button.disabled) {
      button.click();
    }
  });

  const availableColumns = useMemo(() => {
    if (!uploadedData) {
      return [];
    }

    if (uploadedData.columnNames?.length) {
      return uploadedData.columnNames;
    }

    const firstRow = uploadedData.rawData[0] ?? {};
    return Object.keys(firstRow);
  }, [uploadedData]);

  useEffect(() => {
    if (!dataId) {
      showAlert(TEXT.mapping.mappingError, "error");
      router.push("/upload");
      return;
    }

    const loadData = () => {
      let data: UploadedData | undefined = dataCache.get(dataId);

      if (!data) {
        const storeData = useDataStore.getState().uploadedData;
        if (storeData && storeData.id === dataId) {
          data = storeData;
          dataCache.set(dataId, data);
        }
      }

      if (!data) {
        showAlert(TEXT.mapping.mappingError, "error");
        router.push("/upload");
        return;
      }

      if (data.columnMapping) {
        setMapping({
          effect: data.columnMapping.effect,
          se: data.columnMapping.se,
          nObs: data.columnMapping.nObs,
          studyId: data.columnMapping.studyId ?? null,
        });
      } else {
        const guessedMapping = autoMapColumns(data.columnNames ?? []);
        setMapping(guessedMapping);
        setAutoMappingApplied(
          Object.values(guessedMapping).some((value) => value !== null),
        );
      }

      setUploadedData(data);
    };

    loadData();
  }, [dataId, router, showAlert]);

  const previewData = useMemo(() => {
    if (!uploadedData) {
      return [];
    }

    const headers = availableColumns;
    const rows = uploadedData.rawData.slice(0, 5).map((row) =>
      headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) {
          return "";
        }
        return String(value);
      }),
    );

    return [headers, ...rows];
  }, [availableColumns, uploadedData]);

  const usedColumns = useMemo(() => {
    return new Set(
      Object.values(mapping).filter((value): value is string => !!value),
    );
  }, [mapping]);

  const handleMappingChange = (field: keyof MappingState, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleContinue = () => {
    if (!uploadedData || !dataId) {
      showAlert(TEXT.mapping.mappingError, "error");
      router.push("/upload");
      return;
    }

    const missingField = REQUIRED_FIELDS.find((field) => !mapping[field]);

    if (missingField) {
      const fieldLabel = TEXT.mapping.fieldLabels[missingField];
      showAlert(`${fieldLabel} is required.`, "error");
      return;
    }

    const effectColumn = mapping.effect;
    const seColumn = mapping.se;
    const nObsColumn = mapping.nObs;
    const studyIdColumn = mapping.studyId;

    if (!effectColumn || !seColumn || !nObsColumn) {
      showAlert(TEXT.mapping.mappingError, "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedData = uploadedData.rawData.map((row) =>
        convertToNormalizedRow(row, mapping),
      );

      const mappingConfig: ColumnMapping = {
        effect: effectColumn,
        se: seColumn,
        nObs: nObsColumn,
        studyId: studyIdColumn ?? null,
      };

      DataProcessingService.applyColumnMapping(
        dataId,
        mappingConfig,
        normalizedData,
      );

      router.push(`/validation?dataId=${dataId}`);
    } catch (error) {
      console.error("Failed to apply column mapping:", error);
      showAlert(
        "We couldn't apply the column mapping. Please try again.",
        "error",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - ${TEXT.mapping.title}`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full px-2 sm:px-0">
          <GoBackButton href="/upload" text="Back to Upload" />
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-primary">
              {TEXT.mapping.title}
            </h1>
            <p className="text-secondary mb-4">{TEXT.mapping.description}</p>
            <p className="text-muted text-sm mb-6">{TEXT.mapping.helperText}</p>

            {autoMappingApplied && (
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                {TEXT.mapping.autoMappingNotice}
              </div>
            )}

            {!uploadedData ? (
              <div className="text-center py-12 text-muted">
                {TEXT.mapping.loading}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    Object.keys(TEXT.mapping.fieldLabels) as Array<
                      keyof typeof TEXT.mapping.fieldLabels
                    >
                  ).map((field) => {
                    const fieldKey = field as keyof MappingState;
                    const label = TEXT.mapping.fieldLabels[field];
                    const isRequired = REQUIRED_FIELDS.includes(
                      fieldKey as keyof ColumnMapping,
                    );

                    return (
                      <div key={field} className="flex flex-col">
                        <label className="text-sm font-medium text-secondary mb-2">
                          {label}
                          {isRequired ? (
                            <span className="text-red-500">*</span>
                          ) : null}
                        </label>
                        <select
                          className="rounded-lg border border-secondary bg-white p-2 focus:border-primary focus:outline-none"
                          value={mapping[fieldKey] ?? ""}
                          onChange={(event) =>
                            handleMappingChange(fieldKey, event.target.value)
                          }
                        >
                          <option value="">
                            {isRequired ? "Select a column" : "Leave unmapped"}
                          </option>
                          {availableColumns.map((column) => (
                            <option
                              key={column}
                              value={column}
                              disabled={
                                mapping[fieldKey] !== column &&
                                usedColumns.has(column)
                              }
                            >
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-secondary mb-3">
                    {TEXT.mapping.previewTitle}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewData[0]?.map((header, index) => (
                            <th
                              key={header || index}
                              className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.slice(1).map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={`${rowIndex}-${cellIndex}`}
                                className="px-4 py-2 whitespace-nowrap text-sm text-gray-700"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <ActionButton
                  ref={continueButtonRef}
                  onClick={handleContinue}
                  variant="primary"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving mapping..."
                    : TEXT.mapping.continueButton}
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
