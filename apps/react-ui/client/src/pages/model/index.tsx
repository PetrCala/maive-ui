"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import * as XLSX from "xlsx"
import { useRouter } from "next/navigation"
import { generateMockResults, isDevelopmentMode } from "@utils/mockData"

interface ModelParameters {
	modelType: "MAIVE" | "WAIVE"
	includeStudyDummies: boolean
	standardErrorTreatment:
		| "not_clustered"
		| "clustered"
		| "clustered_cr2"
		| "bootstrap"
	computeAndersonRubin: boolean
}

export default function ModelPage() {
	const searchParams = useSearchParams()
	const filename = searchParams?.get("filename")
	const fileData = searchParams?.get("data")
	const [preview, setPreview] = useState<string[][]>([])
	const [loading, setLoading] = useState(false)
	const [parameters, setParameters] = useState<ModelParameters>({
		modelType:
			(searchParams?.get("modelType") as ModelParameters["modelType"]) ||
			"MAIVE",
		includeStudyDummies:
			searchParams?.get("includeStudyDummies") === "true" || false,
		standardErrorTreatment:
			(searchParams?.get(
				"standardErrorTreatment"
			) as ModelParameters["standardErrorTreatment"]) || "not_clustered",
		computeAndersonRubin:
			searchParams?.get("computeAndersonRubin") === "true" || false,
	})
	const router = useRouter()

	useEffect(() => {
		if (fileData) {
			processFileData()
		}
	}, [fileData]) // eslint-disable-line react-hooks/exhaustive-deps

	const processFileData = () => {
		try {
			// Remove the data URL prefix (e.g., "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,")
			const base64Data = fileData!.split(",")[1]
			const binaryData = atob(base64Data)
			const bytes = new Uint8Array(binaryData.length)
			for (let i = 0; i < binaryData.length; i++) {
				bytes[i] = binaryData.charCodeAt(i)
			}

			// Read the Excel file
			const workbook = XLSX.read(bytes, { type: "array" })
			const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
			const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

			// Convert to string[][] and take first 5 rows for preview
			const previewData = (jsonData as any[])
				.slice(0, 5)
				.map((row) => row.map((cell: unknown) => String(cell)))
			setPreview(previewData)

			// Check if studyID column exists and update standard error treatment accordingly
			const headers = previewData[0] || []
			const hasStudyID = headers.some((header: string) =>
				/\bstudy[\s_-]?id\b/i.test(header)
			)
			if (hasStudyID) {
				setParameters((prev) => ({
					...prev,
					standardErrorTreatment: "bootstrap",
				}))
			}
		} catch (error) {
			console.error("Error processing file:", error)
		}
	}

	const handleParameterChange = (
		param: keyof ModelParameters,
		value: string | boolean
	) => {
		setParameters((prev) => ({ ...prev, [param]: value }))
	}

	const handleRunModel = async () => {
		setLoading(true)
		try {
			let result

			if (isDevelopmentMode()) {
				// Use mock data in development mode
				console.debug("Using mock data in development mode")
				result = generateMockResults()
			} else {
				// Make actual API call in production
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_R_API_URL}/run-model`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							file_data: fileData,
							parameters: parameters,
						}),
					}
				)

				if (!response.ok) throw new Error("Failed to run model")
				result = await response.json()
			}

			// Redirect to results page with the model output
			const searchParams = new URLSearchParams({
				results: JSON.stringify(result),
				fileData: fileData || "",
				parameters: JSON.stringify(parameters),
			})
			router.push(`/results?${searchParams.toString()}`)
		} catch (error) {
			console.error("Error running model:", error)
		} finally {
			setLoading(false)
		}
	}

	if (!fileData) {
		return (
			<main className="flex min-h-screen flex-col items-center justify-center p-24">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-4">No file selected</h1>
					<Link href="/upload" className="text-blue-600 hover:text-blue-700">
						Go back to upload
					</Link>
				</div>
			</main>
		)
	}

	return (
		<main className="flex min-h-screen flex-col items-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			<div className="max-w-4xl w-full">
				<Link
					href="/upload"
					className="inline-block mb-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
				>
					← Back to Upload
				</Link>

				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8">
					<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
						File Preview: {filename}
					</h1>
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

				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
					<h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
						Model Parameters
					</h2>
					<div className="space-y-6">
						<div className="grid grid-cols-1 gap-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Model Type
								</label>
								<select
									value={parameters.modelType}
									onChange={(e) =>
										handleParameterChange("modelType", e.target.value)
									}
									className="w-48 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								>
									<option value="MAIVE">MAIVE</option>
									<option value="WAIVE">WAIVE</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Include Study Dummies
								</label>
								<div className="flex space-x-4">
									<label className="inline-flex items-center">
										<input
											type="radio"
											checked={parameters.includeStudyDummies}
											onChange={() =>
												handleParameterChange("includeStudyDummies", true)
											}
											className="form-radio text-blue-600"
										/>
										<span className="ml-2 text-gray-700 dark:text-gray-300">
											Yes
										</span>
									</label>
									<label className="inline-flex items-center">
										<input
											type="radio"
											checked={!parameters.includeStudyDummies}
											onChange={() =>
												handleParameterChange("includeStudyDummies", false)
											}
											className="form-radio text-blue-600"
										/>
										<span className="ml-2 text-gray-700 dark:text-gray-300">
											No
										</span>
									</label>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Standard Error Treatment
								</label>
								<select
									value={parameters.standardErrorTreatment}
									onChange={(e) =>
										handleParameterChange(
											"standardErrorTreatment",
											e.target.value
										)
									}
									className="w-48 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								>
									<option value="not_clustered">Not Clustered</option>
									<option value="clustered">Clustered</option>
									<option value="clustered_cr2">Clustered using CR2</option>
									<option value="bootstrap">Bootstrap</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Compute Anderson-Rubin Confidence Interval
								</label>
								<div className="flex space-x-4">
									<label className="inline-flex items-center">
										<input
											type="radio"
											checked={parameters.computeAndersonRubin}
											onChange={() =>
												handleParameterChange("computeAndersonRubin", true)
											}
											className="form-radio text-blue-600"
										/>
										<span className="ml-2 text-gray-700 dark:text-gray-300">
											Yes
										</span>
									</label>
									<label className="inline-flex items-center">
										<input
											type="radio"
											checked={!parameters.computeAndersonRubin}
											onChange={() =>
												handleParameterChange("computeAndersonRubin", false)
											}
											className="form-radio text-blue-600"
										/>
										<span className="ml-2 text-gray-700 dark:text-gray-300">
											No
										</span>
									</label>
								</div>
							</div>
						</div>

						<button
							onClick={handleRunModel}
							disabled={loading}
							className={`w-full px-6 py-3 text-white font-semibold rounded-lg
								${
									loading
										? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
										: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
								} transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none disabled:hover:shadow-none`}
						>
							{loading ? "Running Model..." : "Run Model"}
						</button>
					</div>
				</div>
			</div>
		</main>
	)
}
