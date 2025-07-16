import Tooltip from "@components/Tooltip"
import HelpIcon from "@components/Icons/HelpIcon"
import { useState } from "react"

interface HelpButtonProps {
	helpText: string
	className?: string
}

export default function HelpButton({
	helpText,
	className = "",
}: HelpButtonProps) {
	const [show, setShow] = useState(false)

	return (
		<span className={`inline-flex items-center ${className}`}>
			<button
				type="button"
				aria-label="Show help"
				onClick={() => setShow((prev) => !prev)}
				className="ml-2 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
				tabIndex={0}
			>
				<HelpIcon />
			</button>
			{show && (
				<span className="ml-2 z-50">
					<Tooltip content={helpText} position="right">
						<span></span>
					</Tooltip>
				</span>
			)}
		</span>
	)
}
