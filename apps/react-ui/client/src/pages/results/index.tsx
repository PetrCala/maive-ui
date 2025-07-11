"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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
		rejectsNull: boolean
	}
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
							<h2 className="text-xl font-semibold mb-4">Effect Estimate</h2>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Estimate
									</p>
									<p className="text-lg font-medium">
										{parsedResults.effectEstimate.toFixed(4)}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Standard Error
									</p>
									<p className="text-lg font-medium">
										{parsedResults.standardError.toFixed(4)}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Significant at 5% level
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
								{!!shouldDisplayAndersonRubinCI && (
									<div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											Anderson-Rubin 95% CI
										</p>
										<p className="text-lg font-medium">
											{typeof parsedResults.andersonRubinCI === "object"
												? `[${parsedResults.andersonRubinCI[0].toFixed(
														4
												  )}, ${parsedResults.andersonRubinCI[1].toFixed(4)}]`
												: "NA"}
										</p>
									</div>
								)}
							</div>
						</div>

						{/* Publication Bias Section */}
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<h2 className="text-xl font-semibold mb-4">
								Publication Bias Analysis
							</h2>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Estimate
									</p>
									<p className="text-lg font-medium">
										{parsedResults.publicationBias.estimate.toFixed(4)}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Standard Error
									</p>
									<p className="text-lg font-medium">
										{parsedResults.publicationBias.standardError.toFixed(4)}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Significant at 5% level
									</p>
									<p
										className={`text-lg font-medium ${
											parsedResults.publicationBias.isSignificant
												? "text-green-600"
												: "text-red-600"
										}`}
									>
										{parsedResults.publicationBias.isSignificant ? "Yes" : "No"}
									</p>
								</div>
							</div>
						</div>

						{/* Tests Section */}
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<h2 className="text-xl font-semibold mb-4">Diagnostic Tests</h2>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										First Stage F-Test
									</p>
									{parsedResults.firstStageFTest === "NA" ? (
										<p className="text-lg font-medium">NA</p>
									) : (
										<p
											className={`text-lg font-medium ${
												parsedResults.firstStageFTest > 10
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{parsedResults.firstStageFTest.toFixed(4)}
											{parsedResults.firstStageFTest > 10 && " (Strong)"}
										</p>
									)}
								</div>
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Hausman Test
									</p>
									<p
										className={`text-lg font-medium ${
											parsedResults.hausmanTest.rejectsNull
												? "text-red-600"
												: "text-green-600"
										}`}
									>
										{parsedResults.hausmanTest.statistic.toFixed(4)}
										{parsedResults.hausmanTest.rejectsNull
											? " (Rejects Null)"
											: " (Fails to Reject Null)"}
									</p>
								</div>
							</div>
						</div>

						{/* Funnel Plot */}
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<h2 className="text-xl font-semibold mb-4">Funnel Plot</h2>
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
