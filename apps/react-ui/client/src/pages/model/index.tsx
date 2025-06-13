"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ThemeToggle } from "@components/ThemeToggle"
import * as XLSX from "xlsx"

interface ModelParameters {
	learningRate: number
	epochs: number
	batchSize: number
	validationSplit: number
}

export default function ModelPage() {
	const searchParams = useSearchParams()
	const filename = searchParams?.get("filename")
	const fileData = searchParams?.get("data")
	const [preview, setPreview] = useState<string[][]>([])
	const [loading, setLoading] = useState(false)
	const [parameters, setParameters] = useState<ModelParameters>({
		learningRate: 0.001,
		epochs: 100,
		batchSize: 32,
		validationSplit: 0.2,
	})

	useEffect(() => {
		if (fileData) {
			processFileData()
		}
	}, [fileData])

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
		} catch (error) {
			console.error("Error processing file:", error)
		}
	}

	const handleParameterChange = (
		param: keyof ModelParameters,
		value: number
	) => {
		setParameters((prev) => ({ ...prev, [param]: value }))
	}

	const handleRunModel = async () => {
		setLoading(true)
		try {
			const response = await fetch("/api/run-model", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					fileData,
					parameters,
				}),
			})

			if (!response.ok) throw new Error("Failed to run model")
			const result = await response.json()
			// TODO: Handle model results (e.g., show plots, summary)
			console.log("Model results:", result)
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
			<ThemeToggle />
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
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Learning Rate
								</label>
								<input
									type="number"
									step="0.001"
									min="0.0001"
									max="1"
									value={parameters.learningRate}
									onChange={(e) =>
										handleParameterChange(
											"learningRate",
											parseFloat(e.target.value)
										)
									}
									className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Epochs
								</label>
								<input
									type="number"
									min="1"
									max="1000"
									value={parameters.epochs}
									onChange={(e) =>
										handleParameterChange("epochs", parseInt(e.target.value))
									}
									className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Batch Size
								</label>
								<input
									type="number"
									min="1"
									max="256"
									value={parameters.batchSize}
									onChange={(e) =>
										handleParameterChange("batchSize", parseInt(e.target.value))
									}
									className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Validation Split
								</label>
								<input
									type="number"
									step="0.1"
									min="0.1"
									max="0.5"
									value={parameters.validationSplit}
									onChange={(e) =>
										handleParameterChange(
											"validationSplit",
											parseFloat(e.target.value)
										)
									}
									className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								/>
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
