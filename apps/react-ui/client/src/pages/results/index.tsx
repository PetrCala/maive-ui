"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Tooltip from "@components/Tooltip"
import { RESULTS_CONFIG } from "@utils/resultsConfig"

interface ModelResults {
	effectEstimate: number
	standardError: number
	isSignificant: boolean
	andersonRubinCI: [number, number] | "NA"
	publicationBias: {
		estimate: number
		standardError: number
		isSignificant: boolean
	}
	firstStageFTest: number | "NA"
	hausmanTest: {
		statistic: number
		criticalValue: number
		rejectsNull: boolean
	}
	seInstrumented: number[]
	funnelPlot: string // Base64 encoded image
}

export default function ResultsPage() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const results = searchParams?.get("results")
	const dataId = searchParams?.get("dataId")
	const parameters = searchParams?.get("parameters")
	const shouldDisplayAndersonRubinCI =
		parameters && JSON.parse(parameters)?.computeAndersonRubin === true

	if (!results) {
		return (
			<main className="flex min-h-screen flex-col items-center justify-center p-24">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-4">No results available</h1>
					<Link href="/upload" className="text-blue-600 hover:text-blue-700">
						Go back to upload
					</Link>
				</div>
			</main>
		)
	}

	const parsedResults: ModelResults = JSON.parse(results)

	const handleRerunModel = () => {
		router.push(`/model?dataId=${dataId}&parameters=${parameters}`)
	}

	const handleNewUpload = () => {
		router.push("/upload")
	}

	return (
		<main className="flex min-h-screen flex-col items-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
			<div className="max-w-4xl w-full space-y-8">
				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8">
					<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
						Model Results
					</h1>

					<div className="space-y-6">
						{/* Effect Estimate Section */}
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<h2 className="text-xl font-semibold mb-4">
								{RESULTS_CONFIG.effectEstimate.title}
							</h2>
							<div className="grid grid-cols-2 gap-4">
								<Tooltip
									content={
										RESULTS_CONFIG.effectEstimate.metrics.estimate.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{RESULTS_CONFIG.effectEstimate.metrics.estimate.label}
										</p>
										<p className="text-lg font-medium">
											{parsedResults.effectEstimate.toFixed(4)}
										</p>
									</div>
								</Tooltip>
								<Tooltip
									content={
										RESULTS_CONFIG.effectEstimate.metrics.standardError.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{
												RESULTS_CONFIG.effectEstimate.metrics.standardError
													.label
											}
										</p>
										<p className="text-lg font-medium">
											{parsedResults.standardError.toFixed(4)}
										</p>
									</div>
								</Tooltip>
								<Tooltip
									content={
										RESULTS_CONFIG.effectEstimate.metrics.significance.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{RESULTS_CONFIG.effectEstimate.metrics.significance.label}
										</p>
										<p
											className={`text-lg font-medium ${
												parsedResults.isSignificant
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{parsedResults.isSignificant ? "Yes" : "No"}
										</p>
									</div>
								</Tooltip>
								{!!shouldDisplayAndersonRubinCI && (
									<Tooltip
										content={
											RESULTS_CONFIG.effectEstimate.metrics.andersonRubinCI
												.tooltip
										}
									>
										<div>
											<p className="text-sm text-gray-600 dark:text-gray-300">
												{
													RESULTS_CONFIG.effectEstimate.metrics.andersonRubinCI
														.label
												}
											</p>
											<p className="text-lg font-medium">
												{typeof parsedResults.andersonRubinCI === "object"
													? `[${parsedResults.andersonRubinCI[0].toFixed(
															4
													  )}, ${parsedResults.andersonRubinCI[1].toFixed(4)}]`
													: "NA"}
											</p>
										</div>
									</Tooltip>
								)}
							</div>
						</div>

						{/* Publication Bias Section */}
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<h2 className="text-xl font-semibold mb-4">
								{RESULTS_CONFIG.publicationBias.title}
							</h2>
							<div className="grid grid-cols-2 gap-4">
								<Tooltip
									content={
										RESULTS_CONFIG.publicationBias.metrics.estimate.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{RESULTS_CONFIG.publicationBias.metrics.estimate.label}
										</p>
										<p className="text-lg font-medium">
											{parsedResults.publicationBias.estimate.toFixed(4)}
										</p>
									</div>
								</Tooltip>
								<Tooltip
									content={
										RESULTS_CONFIG.publicationBias.metrics.standardError.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{
												RESULTS_CONFIG.publicationBias.metrics.standardError
													.label
											}
										</p>
										<p className="text-lg font-medium">
											{parsedResults.publicationBias.standardError.toFixed(4)}
										</p>
									</div>
								</Tooltip>
								<Tooltip
									content={
										RESULTS_CONFIG.publicationBias.metrics.significance.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{
												RESULTS_CONFIG.publicationBias.metrics.significance
													.label
											}
										</p>
										<p
											className={`text-lg font-medium ${
												parsedResults.publicationBias.isSignificant
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{parsedResults.publicationBias.isSignificant
												? "Yes"
												: "No"}
										</p>
									</div>
								</Tooltip>
							</div>
						</div>

						{/* Tests Section */}
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<h2 className="text-xl font-semibold mb-4">
								{RESULTS_CONFIG.diagnosticTests.title}
							</h2>
							<div className="grid grid-cols-2 gap-4">
								<Tooltip
									content={
										RESULTS_CONFIG.diagnosticTests.metrics.hausmanTest.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{RESULTS_CONFIG.diagnosticTests.metrics.hausmanTest.label}
										</p>
										<p
											className={`text-lg font-medium ${
												parsedResults.hausmanTest.rejectsNull
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{parsedResults.hausmanTest.statistic.toFixed(4)}
											{parsedResults.hausmanTest.rejectsNull
												? " (Rejects Null)"
												: " (Fails to Reject Null)"}
										</p>
									</div>
								</Tooltip>
								<Tooltip
									content={
										RESULTS_CONFIG.diagnosticTests.metrics.hausmanCriticalValue
											.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{
												RESULTS_CONFIG.diagnosticTests.metrics
													.hausmanCriticalValue.label
											}
										</p>
										<p className="text-lg font-medium">
											{parsedResults.hausmanTest.criticalValue.toFixed(4)}
										</p>
									</div>
								</Tooltip>
								<Tooltip
									content={
										RESULTS_CONFIG.diagnosticTests.metrics.firstStageFTest
											.tooltip
									}
								>
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											{
												RESULTS_CONFIG.diagnosticTests.metrics.firstStageFTest
													.label
											}
										</p>
										{parsedResults.firstStageFTest === "NA" ? (
											<p className="text-lg font-medium">NA</p>
										) : (
											<p
												className={`text-lg font-medium ${
													parsedResults.firstStageFTest >= 10
														? "text-green-600"
														: "text-red-600"
												}`}
											>
												{parsedResults.firstStageFTest.toFixed(4)}
												{parsedResults.firstStageFTest > 10 && " (Strong)"}
											</p>
										)}
									</div>
								</Tooltip>
							</div>
						</div>

						{/* Funnel Plot */}
						<Tooltip content={RESULTS_CONFIG.funnelPlot.tooltip}>
							<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<h2 className="text-xl font-semibold mb-4">
									{RESULTS_CONFIG.funnelPlot.title}
								</h2>
								<div className="flex justify-center">
									<Image
										src={parsedResults.funnelPlot}
										alt="Funnel Plot"
										width={400}
										height={300}
										className="max-w-full h-auto"
									/>
								</div>
							</div>
						</Tooltip>
					</div>
				</div>

				<div className="flex justify-end items-center mt-8">
					<div className="space-x-4">
						<button
							onClick={handleNewUpload}
							className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
						>
							Upload New Data
						</button>
						<button
							onClick={handleRerunModel}
							className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Rerun Model
						</button>
					</div>
				</div>
			</div>
		</main>
	)
}
