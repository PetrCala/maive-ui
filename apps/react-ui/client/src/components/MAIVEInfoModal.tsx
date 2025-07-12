import CONST from "@src/CONST"

interface MAIVEInfoModalProps {
	isOpen: boolean
	onClose: () => void
}

export default function MAIVEInfoModal({
	isOpen,
	onClose,
}: MAIVEInfoModalProps) {
	if (!isOpen) return null

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
				{/* Header */}
				<div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						What is MAIVE?
					</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="p-6 space-y-6">
					{/* Overview Section */}
					<section>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
							Overview
						</h3>
						<p className="text-gray-700 dark:text-gray-300 leading-relaxed">
							MAIVE (Model-Agnostic Inference for Validation and Estimation) is
							a statistical method designed to detect spurious precision in data
							analysis. It helps identify when statistical results appear more
							precise than they actually are, which can lead to misleading
							conclusions in research and data analysis.
						</p>
					</section>

					{/* How it Works Section */}
					<section>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
							How MAIVE Works
						</h3>
						<div className="space-y-3 text-gray-700 dark:text-gray-300">
							<p className="leading-relaxed">
								MAIVE operates by analyzing the relationship between sample size
								and the precision of statistical estimates. When data exhibits
								spurious precision, the apparent precision increases faster than
								what would be expected given the sample size.
							</p>
							<p className="leading-relaxed">
								The method uses a model-agnostic approach, meaning it
								doesn&apos;t require specific assumptions about the underlying
								data distribution. This makes it applicable to a wide range of
								statistical analyses and research contexts.
							</p>
							<p className="leading-relaxed">
								MAIVE provides a quantitative measure of spurious precision,
								allowing researchers to assess the reliability of their
								statistical findings and make more informed decisions about
								their data analysis.
							</p>
						</div>
					</section>

					{/* Key Features Section */}
					<section>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
							Key Features
						</h3>
						<ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
							<li>
								<strong>Model-Agnostic:</strong> Works with any statistical
								model or analysis method
							</li>
							<li>
								<strong>Quantitative:</strong> Provides numerical measures of
								spurious precision
							</li>
							<li>
								<strong>Robust:</strong> Reliable across different data types
								and sample sizes
							</li>
							<li>
								<strong>Interpretable:</strong> Results are easy to understand
								and communicate
							</li>
							<li>
								<strong>Efficient:</strong> Fast computation suitable for large
								datasets
							</li>
						</ul>
					</section>

					{/* Applications Section */}
					<section>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
							Applications
						</h3>
						<div className="grid md:grid-cols-2 gap-4">
							<div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
								<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
									Research Validation
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300">
									Validate statistical results in academic research and
									peer-reviewed studies
								</p>
							</div>
							<div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
								<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
									Data Quality Assessment
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300">
									Assess the quality and reliability of datasets before analysis
								</p>
							</div>
							<div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
								<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
									Business Intelligence
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300">
									Ensure reliable insights from business data and analytics
								</p>
							</div>
							<div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
								<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
									Policy Making
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300">
									Support evidence-based policy decisions with validated data
								</p>
							</div>
						</div>
					</section>

					{/* Papers and Resources Section */}
					<section>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
							Papers and Resources
						</h3>
						<div className="space-y-3">
							<div className="border-l-4 border-blue-500 pl-4">
								<h4 className="font-semibold text-gray-900 dark:text-white">
									MAIVE Website
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
									View the MAIVE website for more information about the
									estimator.
								</p>
								<a
									href={CONST.MAIVE_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
								>
									View Website →
								</a>
							</div>
							<div className="border-l-4 border-green-500 pl-4">
								<h4 className="font-semibold text-gray-900 dark:text-white">
									Original MAIVE Paper
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
									The foundational paper introducing the MAIVE estimator.
								</p>
								<a
									href={CONST.MAIVE_PAPER_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="text-green-600 dark:text-green-400 hover:underline text-sm"
								>
									View Paper →
								</a>
							</div>
							<div className="border-l-4 border-purple-500 pl-4">
								<h4 className="font-semibold text-gray-900 dark:text-white">
									GitHub Repository
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
									View the source code, technical documentation, and contribute
									on GitHub.
								</p>
								<a
									href={CONST.MAIVE_GITHUB_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="text-purple-600 dark:text-purple-400 hover:underline text-sm"
								>
									Visit GitHub →
								</a>
							</div>
						</div>
					</section>

					{/* Getting Started Section */}
					<section>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
							Getting Started
						</h3>
						<p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
							Ready to check your data for spurious precision? Upload your
							dataset and let MAIVE analyze it for you. The process is simple
							and provides clear, actionable results.
						</p>
						<div className="flex gap-3">
							<button
								onClick={onClose}
								className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							>
								Upload Your Data
							</button>
							<button
								onClick={onClose}
								className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
							>
								Close
							</button>
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}
