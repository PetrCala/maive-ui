"use client"

import HelpIcon from "./Icons/HelpIcon"
import HomeIcon from "./Icons/HomeIcon"

interface HeaderProps {
	showHomeIcon?: boolean
	showHelpIcon?: boolean
	className?: string
}

export default function Header({
	showHomeIcon = true,
	showHelpIcon = true,
	className = "",
}: HeaderProps) {
	return (
		<header className={`flex justify-between items-center w-full ${className}`}>
			{/* Left side - can be used for breadcrumbs or other navigation */}
			<div className="flex-1"></div>

			{/* Right side - icons */}
			{!!showHelpIcon && <HelpIcon />}
			{!!showHomeIcon && <HomeIcon />}
		</header>
	)
}
