/**
 * A button that pings the server and alerts the user with the status and time.
 * @returns A button that pings the server and alerts the user with the status and time.
 */
export default function PingButton() {
	const pingServer = async () => {
		if (!process.env.NEXT_PUBLIC_R_API_URL) {
			alert("NEXT_PUBLIC_R_API_URL is not set")
			return
		}

		const response = await fetch(`${process.env.NEXT_PUBLIC_R_API_URL}/ping`)
		const data = await response.json()
		alert(`Status: ${data.status}, Time: ${data.time}`)
	}

	return (
		<button
			onClick={pingServer}
			className="fixed bottom-8 right-8 mr-2 px-6 py-3 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
		>
			Ping Server
		</button>
	)
}
