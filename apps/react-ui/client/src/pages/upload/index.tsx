"use client";

import { useCallback, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import type { FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { FaFileCsv, FaFileExcel, FaFileAlt } from "react-icons/fa";
import { useDataStore, dataCache } from "@store/dataStore";
import { generateDataId, processUploadedFile } from "@utils/dataUtils";
import { generateMockCSVFile } from "@utils/mockData";
import SuccessIndicator from "@components/SuccessIndicator";
import ActionButton from "@src/components/Buttons/ActionButton";
import { GoBackButton } from "@src/components/Buttons";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import MDXContent from "@src/context/MDXContent";

// Standalone function to get the file icon component based on filename
export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { setUploadedData } = useDataStore();

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setSelectedFile(acceptedFiles[0]);
    }
  };

  const onDropRejected = (rejectedFiles: FileRejection[]) => {
    const rejectedFile = rejectedFiles[0];
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
  };

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
    maxSize: 10 * 1024 * 1024, // 10MB in bytes
  });

  const handleGenerateMockData = () => {
    const mockFile = generateMockCSVFile();
    setSelectedFile(mockFile);
  };

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      void (async () => {
        event.preventDefault();
        if (!selectedFile) {
          return;
        }

        setIsProcessing(true);
        try {
          // Process the uploaded file
          const { data, base64Data } = await processUploadedFile(selectedFile);

          // Generate unique ID for this data
          const dataId = generateDataId();

          // Create the uploaded data object
          const uploadedData = {
            id: dataId,
            filename: selectedFile.name,
            data: data,
            base64Data: base64Data,
            uploadedAt: new Date(),
          };

          // Store in Zustand store and cache
          setUploadedData(uploadedData);
          dataCache.set(dataId, uploadedData);

          // Navigate to validation page with data ID
          router.push(`/validation?dataId=${dataId}`);
        } catch (error) {
          console.error("Error processing file:", error);
          alert(
            "Failed to process the uploaded file. Please ensure it's a valid Excel or CSV file.",
          );
        } finally {
          setIsProcessing(false);
        }
      })();
    },
    [selectedFile, setUploadedData, router],
  );

  const getFileIconComponent = (filename: string, size = 24) => {
    if (filename.endsWith(".csv")) {
      return <FaFileCsv className="text-primary" size={size} />;
    } else if (filename.endsWith(".xls") || filename.endsWith(".xlsx")) {
      return <FaFileExcel className="text-green-600" size={size} />;
    } else {
      return <FaFileAlt className="text-muted" size={size} />;
    }
  };

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Upload Data`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full">
          <GoBackButton href="/" text="Back to Home" />
          <div className="card p-8">
            <h1 className="text-3xl font-bold mb-6 text-primary">
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
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-secondary">
                  Upload your data file
                </label>
                <div className="mt-1 flex gap-3">
                  <div className="flex-grow">
                    <div
                      {...getRootProps()}
                      className="flex flex-1 flex-row items-center border-2 border-dashed border-focus rounded-lg p-6 min-h-[60px] transition-colors duration-200 surface-secondary hover:border-primary-600 focus:border-primary-600 cursor-pointer select-none"
                    >
                      <input {...getInputProps()} />
                      <div className="flex-1 flex flex-col items-start justify-center">
                        <p className="text-primary text-base font-medium">
                          {isDragActive
                            ? "Drop the file here..."
                            : "Drag and drop your file here"}
                        </p>
                        <p className="text-xs text-muted mt-2">
                          Max size: 10MB &nbsp;|&nbsp; .csv, .xls, .xlsx
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={open}
                        className="ml-8 px-4 py-2 text-base font-bold bg-white dark:bg-gray-800 text-primary border border-gray-300 dark:border-gray-600 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors duration-200 interactive"
                        style={{ minWidth: 120 }}
                      >
                        Choose File
                      </button>
                    </div>
                    {selectedFile && (
                      <div className="mt-2 w-full border-2 border-secondary rounded-xl px-6 py-4 text-base flex items-center shadow-lg font-semibold surface-secondary">
                        {/* Icon */}
                        <span className="mr-4 text-2xl flex-shrink-0">
                          {getFileIconComponent(selectedFile.name)}
                        </span>
                        {/* Filename */}
                        <span
                          className="text-primary font-medium truncate max-w-xs"
                          title={selectedFile.name}
                        >
                          {selectedFile.name}
                        </span>
                        {/* File size */}
                        <span className="ml-auto text-muted font-normal text-sm">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                  </div>
                  {process.env.NODE_ENV === "development" &&
                    (!selectedFile ? (
                      <button
                        type="button"
                        onClick={handleGenerateMockData}
                        className="ml-3 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 flex-shrink-0 interactive dark:text-green-400 dark:bg-green-900/20 dark:border-green-800 dark:hover:bg-green-900/30"
                      >
                        Generate Mock Data
                      </button>
                    ) : (
                      <SuccessIndicator />
                    ))}
                </div>
              </div>

              <ActionButton
                onClick={(event) => {
                  void handleSubmit(event as React.FormEvent<HTMLFormElement>);
                }}
                variant="primary"
                className="w-full"
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? "Processing..." : "Upload and Process"}
              </ActionButton>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
