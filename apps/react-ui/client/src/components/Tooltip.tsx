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
	const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
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
			document.addEventListener("mousemove", handleMouseMove)
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove)
		}
	}, [isVisible])

	const handleMouseEnter = () => {
		setIsVisible(true)
	}

	const handleMouseLeave = () => {
		setIsVisible(false)
	}

	return (
		<div
			ref={triggerRef}
			className={`relative inline-block ${className}`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{children}
			{isVisible && (
				<div
					ref={tooltipRef}
					className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg max-w-xs pointer-events-none transition-opacity duration-200"
					style={{
						left: tooltipPosition.x,
						top: tooltipPosition.y,
					}}
				>
					{content}
					{/* Arrow */}
					<div className="absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45 -top-1 -left-1"></div>
				</div>
			)}
		</div>
	)
}
