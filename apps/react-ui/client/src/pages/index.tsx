import Link from "next/link"

export default function Home() {
	const pingServer = async () => {
		const response = await fetch(`${process.env.NEXT_PUBLIC_R_API_URL}/ping`)
		const data = await response.json()
		alert(`Status: ${data.status}, Time: ${data.time}`)
	}

	const PingButton = () => {
		return (
			<button
				onClick={pingServer}
				className="mt-6 inline-block px-8 py-4 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
			>
				Ping Server
			</button>
		)
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			<div className="max-w-2xl text-center">
				<h1 className="text-5xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">
					Welcome to MAIVE Estimator
				</h1>
				<p className="text-xl mb-12 text-gray-600 dark:text-gray-300 leading-relaxed">
					Your tool for advanced data analysis and estimation
				</p>
				<Link
					href="/upload"
					className="inline-block px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
				>
					Upload Your Data
				</Link>
				<PingButton />
			</div>
		</main>
	)
}
