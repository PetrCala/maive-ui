"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDataStore, dataCache } from "@store/dataStore"

interface ValidationMessage {
	type: "success" | "error" | "warning" | "info"
	message: string
}

interface ValidationResult {
	isValid: boolean
	messages: ValidationMessage[]
	containsInfo?: boolean
}

export default function ValidationPage() {
	const searchParams = useSearchParams()
	const dataId = searchParams?.get("dataId")
	const [preview, setPreview] = useState<string[][]>([])
	const [validationResult, setValidationResult] = useState<ValidationResult>({
		isValid: false,
		messages: [],
	})
	const [loading, setLoading] = useState(true)
	const [uploadedData, setUploadedData] = useState<any>(null)
	const router = useRouter()
	// Local state for this component's uploaded data.
	// The global store's setUploadedData is renamed to setStoreData to avoid conflicts.
	// Use local state for component logic and rendering; use the store function for global updates.
	const { setUploadedData: setStoreData } = useDataStore()

	useEffect(() => {
		if (dataId) {
			loadDataFromStore()
		}
	}, [dataId]) // eslint-disable-line react-hooks/exhaustive-deps

	const loadDataFromStore = () => {
		try {
			// Try to get data from cache first
			let data = dataCache.get(dataId!)

			// If not in cache, try to get from store
			if (!data) {
				const storeData = useDataStore.getState().uploadedData
				if (storeData && storeData.id === dataId) {
					data = storeData
					// Also put it back in cache
					dataCache.set(dataId, data)
				}
			}

			if (!data) {
				throw new Error("Data not found")
			}

			setUploadedData(data)

			// Convert data to preview format
			const headers = Object.keys(data.data[0] || {})
			const previewData = [
				headers,
				...data.data
					.slice(0, 4)
					.map((row: any) =>
						headers.map((header: string) => String(row[header] || ""))
					),
			]
			setPreview(previewData)

			// Validate the data
			const validation = validateData(previewData, data.data)
			setValidationResult(validation)
		} catch (error) {
			console.error("Error loading data:", error)
			setValidationResult({
				isValid: false,
				messages: [
					{
						type: "error",
						message:
							"Failed to load the uploaded data. Please try uploading again.",
					},
				],
			})
		} finally {
			setLoading(false)
		}
	}

	const validateData = (
		previewData: string[][],
		fullData: any[]
	): ValidationResult => {
		const messages: ValidationMessage[] = []
		const headers = previewData[0] || []
		const requiredColumns = ["effect", "se", "n_obs"]
		const optionalColumns = ["study_id"]

		// Check if file has data
		if (fullData.length === 0) {
			messages.push({
				type: "error",
				message:
					"The file must contain at least one row of data (excluding headers).",
			})
		}

		// Check if file has headers
		if (headers.length === 0) {
			messages.push({
				type: "error",
				message: "The file must have column headers in the first row.",
			})
		}

		const minimumColumns = requiredColumns.length
		const maximumColumns = minimumColumns + optionalColumns.length
		if (headers.length < minimumColumns || headers.length > maximumColumns) {
			messages.push({
				type: "error",
				message: `The file must have between ${minimumColumns} and ${maximumColumns} columns (${requiredColumns.join(
					", "
				)}${
					optionalColumns.length > 0
						? ", and optionally " + optionalColumns.join(", ")
						: ""
				}).`,
			})
		}

		// Check for required columns (basic validation)
		const findMissingColumns = (columns: string[], headers: string[]) =>
			columns.filter(
				(col) =>
					!headers.some((header) =>
						header.toLowerCase().includes(col.toLowerCase())
					)
			)

		const missingColumns = findMissingColumns(requiredColumns, headers)
		const missingOptionalColumns = findMissingColumns(optionalColumns, headers)

		if (missingColumns.length > 0) {
			messages.push({
				type: "error",
				message: `Missing required columns: ${missingColumns.join(
					", "
				)}. The file must contain columns for effect estimates, standard errors, and number of observations.`,
			})
		}

		if (missingOptionalColumns.length > 0) {
			messages.push({
				type: "info",
				message: `Missing optional columns: ${missingOptionalColumns.join(
					", "
				)}. This column is optional and will be ignored. You can still continue without it.`,
			})
		}

		const columnChecks = [
			{
				name: "effect",
				index: headers.findIndex((header) =>
					header.toLowerCase().includes("effect")
				),
				errorMsg:
					"The effect column contains non-numeric values. All effect estimates must be numbers.",
			},
			{
				name: "se",
				index: headers.findIndex((header) =>
					header.toLowerCase().includes("se")
				),
				errorMsg:
					"The standard error column contains non-numeric values. All standard errors must be numbers.",
			},
			{
				name: "n_obs",
				index: headers.findIndex((header) =>
					header.toLowerCase().includes("n_obs")
				),
				errorMsg:
					"The number of observations column contains non-numeric values. All number of observations must be numbers.",
			},
			{
				name: "study_id",
				index: headers.findIndex((header) =>
					header.toLowerCase().includes("study_id")
				),
				errorMsg:
					"The study ID column contains non-numeric values. All study IDs must be numbers.",
				optional: true,
			},
		]

		// Only check required columns if all are present
		const requiredColsPresent = columnChecks
			.filter((col) => !col.optional)
			.every((col) => col.index !== -1)

		if (requiredColsPresent) {
			columnChecks
				.filter((col) => !col.optional)
				.forEach((col) => {
					const hasNonNumeric = fullData.some((row) => {
						const value = row[headers[col.index]]
						return value !== undefined && value !== null && isNaN(Number(value))
					})
					if (hasNonNumeric) {
						messages.push({
							type: "error",
							message: col.errorMsg,
						})
					}
				})
		}

		// Check optional study_id column if present
		const studyIdCol = columnChecks.find((col) => col.name === "study_id")
		if (studyIdCol && studyIdCol.index !== -1) {
			const hasNonNumeric = fullData.some((row) => {
				const value = row[headers[studyIdCol.index]]
				return value !== undefined && value !== null && isNaN(Number(value))
			})
			if (hasNonNumeric) {
				messages.push({
					type: "error",
					message: studyIdCol.errorMsg,
				})
			}
		}

		// Check for negative standard errors
		const seColIndex = columnChecks.find((col) => col.name === "se")?.index
		if (seColIndex !== -1) {
			const hasNegativeSE = fullData.some((row) => {
				const value =
					seColIndex !== undefined ? Number(row[headers[seColIndex]]) : NaN
				return !isNaN(value) && value < 0
			})

			if (hasNegativeSE) {
				messages.push({
					type: "error",
					message:
						"Standard errors cannot be negative. Please check your data.",
				})
			}
		}

		// Check for missing values
		const hasMissingValues = fullData.some((row) =>
			Object.values(row).some(
				(cell: unknown) => cell === undefined || cell === null || cell === ""
			)
		)

		if (hasMissingValues) {
			messages.push({
				type: "warning",
				message:
					"The data contains missing values. These will be excluded from the analysis.",
			})
		}

		// Check for reasonable data size
		if (fullData.length > 2000) {
			messages.push({
				type: "warning",
				message:
					"Large dataset detected. Processing may take longer than usual.",
			})
		}

		// If no errors, add success message
		const hasErrors = messages.some((msg) => msg.type === "error")
		if (!hasErrors) {
			messages.push({
				type: "success",
				message: "Your data is valid and ready for analysis!",
			})
		}

		return {
			isValid: !hasErrors,
			messages,
			containsInfo: messages.some((msg) => msg.type === "info"),
		}
	}

	const handleContinue = () => {
		if (validationResult.isValid && uploadedData) {
			router.push(`/model?dataId=${dataId}`)
		}
	}

	if (!dataId) {
		return (
			<main className="flex min-h-screen flex-col items-center justify-center p-24">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-4">No data selected</h1>
					<Link href="/upload" className="text-blue-600 hover:text-blue-700">
						Go back to upload
					</Link>
				</div>
			</main>
		)
	}

	if (loading) {
		return (
			<main className="flex min-h-screen flex-col items-center justify-center p-24">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600 dark:text-gray-300">
						Validating your data...
					</p>
				</div>
			</main>
		)
	}

	return (
		<main className="flex min-h-screen flex-col items-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			<div className="max-w-4xl w-full space-y-8">
				<Link
					href="/upload"
					className="inline-block mb-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
				>
					← Back to Upload
				</Link>

				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
					<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
						Data Validation: {uploadedData?.filename}
					</h1>

					{/* File Preview */}
					<div className="mb-8">
						<h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							File Preview
						</h2>
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
								<thead className="bg-gray-50 dark:bg-gray-700">
									<tr>
										{preview[0]?.map((header, index) => (
											<th
												key={index}
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
									{preview.slice(1).map((row, rowIndex) => (
										<tr key={rowIndex}>
											{row.map((cell, cellIndex) => (
												<td
													key={cellIndex}
													className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
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

					{/* Validation Messages */}
					<div>
						<h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							Validation Results
						</h2>
						<div className="space-y-3">
							{validationResult.messages.map((message, index) => (
								<div
									key={index}
									className={`p-4 rounded-lg border ${
										message.type === "success"
											? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
											: message.type === "error"
											? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
											: message.type === "info"
											? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
											: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300"
									}`}
								>
									<div className="flex items-center">
										{message.type === "success" && (
											<svg
												className="w-5 h-5 mr-2"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clipRule="evenodd"
												/>
											</svg>
										)}
										{message.type === "error" && (
											<svg
												className="w-5 h-5 mr-2"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
													clipRule="evenodd"
												/>
											</svg>
										)}
										{message.type === "warning" && (
											<svg
												className="w-5 h-5 mr-2"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fillRule="evenodd"
													d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
													clipRule="evenodd"
												/>
											</svg>
										)}
										{message.type === "info" && (
											<svg
												className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fillRule="evenodd"
													d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 10-2 0 1 1 0 002 0zm-1 3a1 1 0 00-1 1v3a1 1 0 002 0v-3a1 1 0 00-1-1z"
													clipRule="evenodd"
												/>
											</svg>
										)}
										<span className="font-medium">{message.message}</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex justify-end items-center space-x-4">
					{(!validationResult.isValid || validationResult.containsInfo) && (
						<button
							onClick={() => {
								window.location.href = "/upload"
							}}
							className="px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-800 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
						>
							Reupload Your Data
						</button>
					)}
					<button
						onClick={handleContinue}
						disabled={!validationResult.isValid}
						className={`px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 ${
							validationResult.isValid
								? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
								: "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
						}`}
					>
						Continue to Model
					</button>
				</div>
			</div>
		</main>
	)
}
