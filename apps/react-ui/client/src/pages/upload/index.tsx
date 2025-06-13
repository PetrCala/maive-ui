"use client"

import { useState } from "react"
import Link from "next/link"
import { ThemeToggle } from "@components/ThemeToggle"
import { useRouter } from "next/navigation"

export default function UploadPage() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const router = useRouter()

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files[0]) {
			setSelectedFile(event.target.files[0])
		}
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!selectedFile) return

		// Convert file to base64 for URL state
		const reader = new FileReader()
		reader.onload = () => {
			const base64Data = reader.result as string
			// Navigate to model page with file data
			router.push(
				`/model?filename=${encodeURIComponent(
					selectedFile.name
				)}&data=${encodeURIComponent(base64Data)}`
			)
		}
		reader.readAsDataURL(selectedFile)
	}

	// const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
	// 	const file = e.target.files?.[0]
	// 	if (!file) return

	// 	const data = new FormData()
	// 	data.append("file", file)

	// 	const res = await fetch("/api/upload", { method: "POST", body: data })
	// 	const json = await res.json()
	// 	setPreview(json.preview) // first 20 rows ↓
	// }

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			<ThemeToggle />
			<div className="max-w-2xl w-full">
				<Link
					href="/"
					className="inline-block mb-8 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
				>
					← Back to Home
				</Link>

				<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
					<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
						Upload Your Data
					</h1>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-2">
							<label
								htmlFor="file-upload"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Select your data file
							</label>
							<div className="mt-1">
								<input
									id="file-upload"
									type="file"
									accept=".xlsx,.xls"
									onChange={handleFileChange}
									className="block w-full text-sm text-gray-500
										file:mr-4 file:py-2 file:px-4
										file:rounded-full file:border-0
										file:text-sm file:font-semibold
										file:bg-blue-50 file:text-blue-700
										hover:file:bg-blue-100
										dark:file:bg-blue-900/50 dark:file:text-blue-300
										dark:hover:file:bg-blue-900/70
										dark:text-gray-400
										cursor-pointer
										transition-colors duration-200"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={!selectedFile}
							className={`w-full px-6 py-3 text-white font-semibold rounded-lg
								${
									selectedFile
										? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
										: "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
								} transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none disabled:hover:shadow-none`}
						>
							Upload and Process
						</button>
					</form>
				</div>
			</div>
		</main>
	)
}
