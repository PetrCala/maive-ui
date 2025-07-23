import { useEffect, useState } from "react"
import Alert from "./Alert"

interface AlertPopupProps {
	message: string
	type?: "info" | "success" | "warning" | "error"
	duration?: number // ms
}

const AlertPopup = ({ message, type = "info", duration = 4000 }: AlertPopupProps) => {
	const [visible, setVisible] = useState(true)

	useEffect(() => {
		if (!visible) return
		const timer = setTimeout(() => setVisible(false), duration)
		return () => clearTimeout(timer)
	}, [visible, duration])

	if (!visible) return null

	return (
		<Alert
			message={message}
			type={type}
			standalone
			onClick={() => setVisible(false)}
			className="transition-opacity duration-300"
		/>
	)
}

export default AlertPopup 