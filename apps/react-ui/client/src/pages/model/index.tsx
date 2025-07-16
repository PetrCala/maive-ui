"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { generateMockResults, shouldUseMockResults } from "@utils/mockData"
import { useDataStore, dataCache } from "@store/dataStore"
import CONST from "@src/CONST"

interface ModelParameters {
	modelType: "MAIVE" | "WAIVE"
	includeStudyDummies: boolean
	standardErrorTreatment:
		| "not_clustered"
		| "clustered"
		| "clustered_cr2"
		| "bootstrap"
	computeAndersonRubin: boolean
	maiveMethod: "PET" | "PEESE" | "PET-PEESE" | "EK"
}

export default function ModelPage() {
	const searchParams = useSearchParams()
	const dataId = searchParams?.get("dataId")
	const [loading, setLoading] = useState(false)
	const [uploadedData, setUploadedData] = useState<any>(null)
	const [parameters, setParameters] = useState<ModelParameters>({
		modelType: "MAIVE",
		includeStudyDummies: false,
		standardErrorTreatment: "not_clustered",
		computeAndersonRubin: false,
		maiveMethod: "PET-PEESE",
	})
	const router = useRouter()

	useEffect(() => {
		if (dataId) {
			loadDataFromStore()
		}
	}, [dataId]) // eslint-disable-line react-hooks/exhaustive-deps

	useMemo(() => {
		if (searchParams?.get("parameters")) {
			const parsed = JSON.parse(
				decodeURIComponent(searchParams.get("parameters") || "{}")
			) as Partial<ModelParameters>
			const params = { ...parameters, ...parsed }
			setParameters(params)
		}
	}, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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

			// Check if studyID column exists and update standard error treatment accordingly
			const headers = Object.keys(data.data[0] || {})
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
			console.error("Error loading data:", error)
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
			let result: { data?: any; error?: any; message?: string }

			if (shouldUseMockResults()) {
				// Use mock data in development mode
				console.debug("Generating mock results in development mode")
				const nrow = uploadedData.data.length
				result = { data: generateMockResults(nrow) }
			} else {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_R_API_URL}/run-model`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							file_data: JSON.stringify(uploadedData.data),
							parameters: JSON.stringify(parameters),
						}),
					}
				)

				if (!response.ok) throw new Error("Failed to run model")
				result = await response.json()
			}

			if (result.error) {
				throw new Error(result?.message || "Failed to run model")
			}

			// Redirect to results page with the model output
			const results = result.data
			const searchParams = new URLSearchParams({
				results: JSON.stringify(results),
				dataId: dataId || "",
				parameters: JSON.stringify(parameters),
			})
			router.push(`/results?${searchParams.toString()}`)
		} catch (error) {
			console.error("Error running model:", error)
			alert(
				"An error occurred while running the model: " +
					(error instanceof Error ? error.message : String(error))
			)
		} finally {
			setLoading(false)
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

	return (
		<main className="flex min-h-screen flex-col items-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			<div className="max-w-4xl w-full">
				<Link
					href={`/validation?dataId=${dataId}`}
					className="inline-block mb-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
				>
					← Back to Validation
				</Link>

				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
					<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
						Model Parameters
					</h1>
					<div className="mb-6">
						<p className="text-gray-700 dark:text-gray-300 mb-2">
							Please select the model type and parameters you would like to use.
						</p>
					</div>

					<div className="space-y-6">
						<div className="grid grid-cols-1 gap-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Model Type
								</label>
								{CONST.WAIVE_ENABLED ? (
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
								) : (
									<p>{parameters.modelType}</p>
								)}
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

						{/* Advanced Options Collapsible Section */}
						<AdvancedOptions
							maiveMethod={parameters.maiveMethod}
							handleParameterChange={handleParameterChange}
						/>

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

function AdvancedOptions({
	maiveMethod,
	handleParameterChange,
}: {
	maiveMethod: "PET" | "PEESE" | "PET-PEESE" | "EK"
	handleParameterChange: (
		param: keyof ModelParameters,
		value: string | boolean
	) => void
}) {
	const [open, setOpen] = useState(false)
	return (
		<div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
			<button
				onClick={() => setOpen((prev) => !prev)}
				className="flex items-center text-blue-600 dark:text-blue-400 font-semibold focus:outline-none"
				aria-expanded={open}
			>
				<span className="mr-2">Advanced Options</span>
				<svg
					className={`w-4 h-4 transform transition-transform duration-200 ${
						open ? "rotate-90" : "rotate-0"
					}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 5l7 7-7 7"
					/>
				</svg>
			</button>
			{open && (
				<div className="mt-4 space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							MAIVE Method
						</label>
						{}
						<select
							value={maiveMethod}
							onChange={(e) =>
								handleParameterChange("maiveMethod", e.target.value)
							}
							className="w-48 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
						>
							<option value="PET">PET</option>
							<option value="PEESE">PEESE</option>
							<option value="PET-PEESE">PET-PEESE</option>
							<option value="EK">EK</option>
						</select>
					</div>
				</div>
			)}
		</div>
	)
}
