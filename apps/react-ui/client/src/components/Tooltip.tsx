"use client"

import { useState, useRef, useEffect } from "react"

interface TooltipProps {
	children: React.ReactNode
	content: string
	position?: "top" | "bottom" | "left" | "right"
	className?: string
}

export default function Tooltip({
	children,
	content,
	position = "top",
	className = "",
}: TooltipProps) {
	const [isVisible, setIsVisible] = useState(false)
	const [tooltipPosition, setTooltipPosition] = useState<{
		x: number
		y: number
	} | null>(null)
	const triggerRef = useRef<HTMLDivElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (tooltipRef.current && isVisible) {
				const tooltip = tooltipRef.current
				const rect = tooltip.getBoundingClientRect()
				const viewportWidth = window.innerWidth
				const viewportHeight = window.innerHeight

				let x = e.clientX + 10
				let y = e.clientY - 10

				// Adjust position to keep tooltip within viewport
				if (x + rect.width > viewportWidth) {
					x = e.clientX - rect.width - 10
				}
				if (y + rect.height > viewportHeight) {
					y = e.clientY - rect.height - 10
				}
				if (x < 0) x = 10
				if (y < 0) y = 10

				setTooltipPosition({ x, y })
			}
		}

		if (isVisible) {
			// Initialize position based on trigger element
			if (triggerRef.current && !tooltipPosition) {
				const triggerRect = triggerRef.current.getBoundingClientRect()
				setTooltipPosition({
					x: triggerRect.left + triggerRect.width / 2,
					y: triggerRect.top - 10,
				})
			}

			document.addEventListener("mousemove", handleMouseMove)
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove)
		}
	}, [isVisible, tooltipPosition])

	const handleMouseEnter = () => {
		setIsVisible(true)
	}

	const handleMouseLeave = () => {
		setIsVisible(false)
		setTooltipPosition(null)
	}

	return (
		<div
			ref={triggerRef}
			className={`relative inline-block ${className}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{children}
			{isVisible && tooltipPosition && (
				<div
					ref={tooltipRef}
					className="fixed z-50 px-3 py-2 text-sm text-white bg-black dark:bg-gray-800 rounded-lg shadow-xl max-w-xs pointer-events-none transition-opacity duration-200 border border-gray-200 dark:border-gray-600"
					style={{
						left: tooltipPosition.x,
						top: tooltipPosition.y,
					}}
				>
					{content}
					{/* Arrow */}
					<div className="absolute w-2 h-2 bg-black dark:bg-gray-800 transform rotate-45 -top-1 -left-1 border-l border-t border-gray-200 dark:border-gray-600"></div>
				</div>
			)}
		</div>
	)
}
