import { useEffect, useState } from "react"
import Alert from "./Alert"

interface AlertPopupProps {
	message: string
	type?: "info" | "success" | "warning" | "error"
	duration?: number // ms
}

const FADE_DURATION = 300 // ms

const AlertPopup = ({ message, type = "info", duration = 2500 }: AlertPopupProps) => {
	const [visible, setVisible] = useState(true)
	const [show, setShow] = useState(false)

	useEffect(() => {
		setShow(true)
	}, [])

	useEffect(() => {
		if (!visible) return
		const timer = setTimeout(() => setShow(false), duration)
		return () => clearTimeout(timer)
	}, [visible, duration])

	// After fade-out, unmount
	useEffect(() => {
		if (show) return
		const timer = setTimeout(() => setVisible(false), FADE_DURATION)
		return () => clearTimeout(timer)
	}, [show])

	if (!visible) return null

	return (
		<div
			style={{ pointerEvents: "auto" }}
			className={`transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
		>
			<Alert
				message={message}
				type={type}
				standalone
				onClick={() => setShow(false)}
			/>
		</div>
	)
}

export default AlertPopup 