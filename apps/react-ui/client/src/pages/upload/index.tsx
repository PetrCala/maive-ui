"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter, useSearchParams } from "next/navigation";
import type { FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { FaFileCsv, FaFileExcel, FaFileAlt } from "react-icons/fa";

import ActionButton from "@src/components/Buttons/ActionButton";
import { GoBackButton } from "@src/components/Buttons";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import MDXContent from "@src/context/MDXContent";
import CONFIG from "@src/CONFIG";
import { getRandomMockCsvFile } from "@src/utils/mockCsvFiles";
import { generateMockCSVFile } from "@src/utils/mockData";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";
import { DataProcessingService } from "@src/services/dataProcessingService";

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const existingDataId = searchParams?.get("dataId");
    if (existingDataId) {
      router.replace(`/validation?dataId=${existingDataId}`);
    }
  }, [router, searchParams]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const onDropRejected = useCallback((rejectedFiles: FileRejection[]) => {
    const rejectedFile = rejectedFiles[0];
    if (!rejectedFile) {
      return;
    }

    if (
      rejectedFile.errors.some(
        (error: { code: string }) => error.code === "file-too-large",
      )
    ) {
      alert("File is too large. Maximum file size is 10MB.");
    } else if (
      rejectedFile.errors.some(
        (error: { code: string }) => error.code === "file-invalid-type",
      )
    ) {
      alert("Invalid file type. Please upload a CSV, XLS, or XLSX file.");
    } else {
      alert("File upload failed. Please try again.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "text/csv": [".csv"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "application/vnd.ms-excel": [".xls"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    maxSize: 10 * 1024 * 1024,
  });

  const handleGenerateMockData = useCallback(() => {
    try {
      const mockFile = generateMockCSVFile();
      setSelectedFile(mockFile);
    } catch (error) {
      console.error("Error generating mock data:", error);
    }
  }, []);

  const handleLoadRandomMockCsv = useCallback(() => {
    try {
      const randomFile = getRandomMockCsvFile();
      const blob = new Blob([randomFile.content], { type: "text/csv" });
      const file = new File([blob], randomFile.filename, { type: "text/csv" });
      setSelectedFile(file);
    } catch (error) {
      console.error("Error loading random mock CSV:", error);
      handleGenerateMockData();
    }
  }, [handleGenerateMockData]);

  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  useEnterKeyAction(() => {
    const button = uploadButtonRef.current;

    if (button && !button.disabled) {
      button.click();
    }
  });

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedFile) {
        return;
      }

      setIsProcessing(true);
      try {
        const newDataId =
          await DataProcessingService.processAndStoreFile(selectedFile);
        setSelectedFile(null);
        router.push(`/validation?dataId=${newDataId}`);
      } catch (error) {
        console.error("Error processing file:", error);
        alert(
          "Failed to process the uploaded file. Please ensure it's a valid Excel or CSV file.",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [router, selectedFile],
  );

  const getFileIconComponent = (filename: string, size = 24) => {
    if (filename.endsWith(".csv")) {
      return <FaFileCsv className="text-primary" size={size} />;
    }
    if (filename.endsWith(".xls") || filename.endsWith(".xlsx")) {
      return <FaFileExcel className="text-green-600" size={size} />;
    }
    return <FaFileAlt className="text-muted" size={size} />;
  };

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Upload Data`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full px-2 sm:px-0">
          <GoBackButton href="/" text="Back to Home" />
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary">
              {TEXT.upload.title}
            </h1>
            <div className="mb-6">
              <p className="text-secondary mb-2">{TEXT.upload.description}</p>
              <ul className="custom-bullet-list text-secondary">
                {Object.values(TEXT.upload.requirements).map(
                  (requirement, index) => (
                    <li key={index}>
                      <span className="bullet">•</span>
                      <div className="content">
                        <MDXContent
                          source={requirement}
                          className="list-item"
                        />
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <form
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-secondary">
                  Upload your data file
                </label>
                <div className="mt-1 flex flex-col gap-4 sm:flex-row">
                  <div className="flex-grow">
                    <div
                      {...getRootProps()}
                      className="flex w-full flex-col gap-4 sm:flex-row sm:items-center border-2 border-dashed border-focus rounded-lg p-6 min-h-[60px] transition-colors duration-200 surface-secondary hover:border-primary-600 focus:border-primary-600 cursor-pointer select-none"
                    >
                      <input {...getInputProps()} />
                      <div className="flex-1 flex flex-col items-start justify-center text-center sm:text-left">
                        <p className="text-primary text-base font-medium">
                          {isDragActive
                            ? "Drop the file here..."
                            : "Drag and drop your file here"}
                        </p>
                        <p className="text-xs text-muted mt-2">
                          Max size: 10MB &nbsp;|&nbsp; .csv, .xls, .xlsx
                        </p>
                      </div>
                      <ActionButton
                        onClick={open}
                        variant="secondary"
                        size="md"
                        className="w-full sm:w-auto sm:ml-8 sm:self-center rounded-full shadow-md"
                        style={{ minWidth: 120 }}
                      >
                        Choose File
                      </ActionButton>
                    </div>
                    {selectedFile && (
                      <div className="mt-2 w-full border-2 border-secondary rounded-xl px-6 py-4 text-base flex flex-col gap-3 sm:flex-row sm:items-center shadow-lg font-semibold surface-secondary">
                        <span className="text-2xl flex-shrink-0 sm:mr-4">
                          {getFileIconComponent(selectedFile.name)}
                        </span>
                        <span
                          className="text-primary font-medium truncate max-w-full sm:max-w-xs"
                          title={selectedFile.name}
                        >
                          {selectedFile.name}
                        </span>
                        <span className="text-muted font-normal text-sm sm:ml-auto sm:self-auto self-start">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!selectedFile && CONFIG.SHOULD_SUGGEST_MOCK_DATA_USE && (
                <div className="flex justify-center sm:justify-end">
                  <div className="flex flex-col items-center gap-1 text-sm text-muted sm:flex-row sm:gap-2 sm:text-left">
                    <span className="text-center sm:text-left">
                      Don&apos;t have your data ready yet?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleLoadRandomMockCsv();
                      }}
                      className="text-sm font-bold text-primary hover:text-primary/80 transition-colors duration-200 cursor-pointer underline hover:no-underline"
                    >
                      Use mock data!
                    </button>
                  </div>
                </div>
              )}

              <ActionButton
                ref={uploadButtonRef}
                type="submit"
                variant="primary"
                className="w-full"
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? "Processing..." : "Upload and validate"}
              </ActionButton>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
