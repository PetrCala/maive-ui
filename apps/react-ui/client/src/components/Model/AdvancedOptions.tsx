import { useState } from "react"
import type { ModelParameters } from "@src/types"
import CONST from "@src/CONST"

export default function AdvancedOptions({
	maiveMethod,
	shouldUseInstrumenting,
	handleParameterChange,
}: {
	maiveMethod: (typeof CONST.MAIVE_METHODS)[keyof typeof CONST.MAIVE_METHODS]
	shouldUseInstrumenting: boolean
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
						<select
							value={maiveMethod}
							onChange={(e) =>
								handleParameterChange(
									"maiveMethod",
									e.target
										.value as (typeof CONST.MAIVE_METHODS)[keyof typeof CONST.MAIVE_METHODS]
								)
							}
							className="w-48 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
						>
							{Object.values(CONST.MAIVE_METHODS).map((method) => (
								<option key={method} value={method}>
									{method}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Use Instrumenting
						</label>
						<div className="flex space-x-4">
							<label className="inline-flex items-center">
								<input
									type="radio"
									checked={shouldUseInstrumenting}
									onChange={() =>
										handleParameterChange("shouldUseInstrumenting", true)
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
									checked={!shouldUseInstrumenting}
									onChange={() =>
										handleParameterChange("shouldUseInstrumenting", false)
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
			)}
		</div>
	)
}
