"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDataStore, dataCache } from "@store/dataStore"
import { generateDataId, processUploadedFile } from "@utils/dataUtils"
import { generateMockCSVFile } from "@utils/mockData"
import SuccessIndicator from "@components/SuccessIndicator"
import { useDropzone } from "react-dropzone"

export default function UploadPage() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const router = useRouter()
	const { setUploadedData } = useDataStore()

	const onDrop = (acceptedFiles: File[]) => {
		if (acceptedFiles && acceptedFiles[0]) {
			setSelectedFile(acceptedFiles[0])
		}
	}
	const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
		onDrop,
		accept: {
			".csv": [".csv"],
			".xls": [".xls"],
			".xlsx": [".xlsx"],
		},
		multiple: false,
		noClick: true,
		noKeyboard: true,
	})

	const handleGenerateMockData = () => {
		const mockFile = generateMockCSVFile()
		setSelectedFile(mockFile)
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!selectedFile) return

		setIsProcessing(true)
		try {
			// Process the uploaded file
			const { data, base64Data } = await processUploadedFile(selectedFile)

			// Generate unique ID for this data
			const dataId = generateDataId()

			// Create the uploaded data object
			const uploadedData = {
				id: dataId,
				filename: selectedFile.name,
				data: data,
				base64Data: base64Data,
				uploadedAt: new Date(),
			}

			// Store in Zustand store and cache
			setUploadedData(uploadedData)
			dataCache.set(dataId, uploadedData)

			// Navigate to validation page with data ID
			router.push(`/validation?dataId=${dataId}`)
		} catch (error) {
			console.error("Error processing file:", error)
			alert(
				"Failed to process the uploaded file. Please ensure it's a valid Excel or CSV file."
			)
		} finally {
			setIsProcessing(false)
		}
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			<div className="max-w-2xl w-full">
				<Link
					href="/"
					className="inline-block mb-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
				>
					← Back to Home
				</Link>

				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
					<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
						Upload Your Data
					</h1>
					<div className="mb-6">
						<p className="text-gray-700 dark:text-gray-300 mb-2">
							Please ensure your data file meets the following requirements:
						</p>
						<ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
							<li>
								The file must be in <strong>.xlsx</strong>,{" "}
								<strong>.xls</strong>, or <strong>.csv</strong> format.
							</li>
							<li>The first row should contain column headers.</li>
							<li>
								Required columns: <strong>effect</strong>, <strong>se</strong>,
								and <strong>n_obs</strong>.
							</li>
							<li>
								Optional columns: <strong>study_id</strong>.
							</li>
							<li>
								<strong>No additional columns</strong> are allowed.
							</li>
							<li>
								The <strong>effect</strong> column represents the effect
								estimate. It must contain only numbers.
							</li>
							<li>
								The <strong>se</strong> column represents the standard error. It
								must contain only non-negative numbers.
							</li>
							<li>
								The <strong>n_obs</strong> column represents the number of
								observations. It must contain only positive numbers.
							</li>
							<li>
								The <strong>study_id</strong> column represents the study ID. It
								must contain only numbers.
							</li>
						</ul>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Upload your data file
							</label>
							<div className="mt-1 flex gap-3">
								<div className = "flex-grow">
									<div {...getRootProps()} className="flex flex-1 flex-row items-center border-2 border-dashed border-blue-400 rounded-lg p-6 min-h-[120px] transition-colors duration-200 bg-blue-50 dark:bg-blue-900/30 hover:border-blue-600 focus:border-blue-600 cursor-pointer select-none">
										<input {...getInputProps()} />
										<div className="flex-1 flex flex-col items-start justify-center">
											<p className="text-blue-700 dark:text-blue-200 text-base font-medium">
												{isDragActive ? "Drop the file here..." : "Drag and drop your file here"}
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
												Max size: 200MB &nbsp;|&nbsp; .csv, .xls, .xlsx 
											</p>
										</div>
										<button
											type="button"
											onClick={open}
											className="ml-8 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-base file:font-bold file:bg-blue-100 file:text-blue-800 hover:file:bg-blue-200 hover:file:text-blue-900 dark:file:bg-blue-800/60 dark:file:text-blue-200 dark:hover:file:bg-blue-900/80 dark:hover:file:text-blue-100 dark:text-gray-500 cursor-pointer transition-colors duration-200 px-4 py-2 text-base font-bold bg-blue-100 text-blue-800 rounded-full border-0 shadow-sm hover:bg-blue-200 hover:text-blue-900 dark:hover:bg-blue-800/80 dark:hover:text-blue-100"
											style={{ minWidth: 120 }}
										>
											Choose File
										</button>
									</div>
									{selectedFile && (
										<div className="mt-2 w-full border-2 border-gray-400 dark:border-gray-600 rounded-xl px-6 py-4 text-base text-gray-900 dark:text-gray-100 flex flex-col shadow-lg font-semibold">
											<span className="font-medium">Selected file:</span>
											<span>{selectedFile.name} ({(selectedFile.size/1024/1024).toFixed(2)} MB)</span>
										</div>
									)}
								</div>
								{process.env.NODE_ENV === "development" &&
									(!selectedFile ? (
										<button
											type="button"
											onClick={handleGenerateMockData}
											className="ml-3 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/70 transition-colors duration-200 flex-shrink-0"
										>
											Generate Mock Data
										</button>
									) : (
										<SuccessIndicator />
									))}
							</div>
						</div>

						<button
							type="submit"
							disabled={!selectedFile || isProcessing}
							className={`w-full px-6 py-3 text-white font-semibold rounded-lg
								${
									selectedFile && !isProcessing
										? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
										: "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
								} transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none disabled:hover:shadow-none`}
						>
							{isProcessing ? "Processing..." : "Upload and Process"}
						</button>
					</form>
				</div>
			</div>
		</main>
	)
}
