"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDataStore, dataCache } from "@store/dataStore"
import { generateDataId, processUploadedFile } from "@utils/dataUtils"
import { generateMockCSVFile } from "@utils/mockData"
import SuccessIndicator from "@components/SuccessIndicator"

export default function UploadPage() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const router = useRouter()
	const { setUploadedData } = useDataStore()

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files[0]) {
			setSelectedFile(event.target.files[0])
		}
	}

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
							<label
								htmlFor="file-upload"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Select your data file
							</label>
							<div className="mt-1 flex gap-3">
								<input
									id="file-upload"
									type="file"
									accept=".xlsx,.xls,.csv"
									onChange={handleFileChange}
									className="block flex-1 text-sm text-gray-500
										file:mr-4 file:py-2 file:px-4
										file:rounded-full file:border-0
										file:text-sm file:font-semibold
										file:bg-blue-50 file:text-blue-700
										hover:file:bg-blue-100
										dark:file:bg-blue-900/50 dark:file:text-blue-300
										dark:hover:file:bg-blue-900/70
										dark:text-gray-400
										cursor-pointer
										transition-colors duration-200"
								/>
								{process.env.NODE_ENV === "development" &&
									(!selectedFile ? (
										<button
											type="button"
											onClick={handleGenerateMockData}
											className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/70 transition-colors duration-200"
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
