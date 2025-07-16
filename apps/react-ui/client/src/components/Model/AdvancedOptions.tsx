import { useState } from "react"
import type { DeepValueOf, ModelParameters } from "@src/types"
import { YesNoSelect, DropdownSelect } from "@src/components/Options"
import CONST from "@src/CONST"

export default function AdvancedOptions({
	maiveMethod,
	shouldUseInstrumenting,
	handleParameterChange,
}: {
	maiveMethod: DeepValueOf<typeof CONST.MAIVE_METHODS>
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
					<DropdownSelect
						label="MAIVE Method"
						value={maiveMethod}
						onChange={(value) =>
							handleParameterChange(
								"maiveMethod",
								value as DeepValueOf<typeof CONST.MAIVE_METHODS>
							)
						}
						options={Object.values(CONST.MAIVE_METHODS).map((method) => ({
							value: method,
							label: method,
						}))}
					/>
					<YesNoSelect
						label="Use Instrumenting"
						value={shouldUseInstrumenting}
						onChange={(value) =>
							handleParameterChange("shouldUseInstrumenting", value)
						}
					/>
				</div>
			)}
		</div>
	)
}
