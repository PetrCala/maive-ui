import * as XLSX from "xlsx"

// Generate a unique ID for uploaded data
export const generateDataId = (): string => {
	return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Process uploaded file and return structured data
export const processUploadedFile = async (
	file: File
): Promise<{
	data: any[]
	base64Data: string
}> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = () => {
			try {
				const base64Data = reader.result as string

				// Remove the data URL prefix
				const base64Content = base64Data.split(",")[1]
				const binaryData = atob(base64Content)
				const bytes = new Uint8Array(binaryData.length)

				for (let i = 0; i < binaryData.length; i++) {
					bytes[i] = binaryData.charCodeAt(i)
				}

				// Read the Excel/CSV file
				const workbook = XLSX.read(bytes, { type: "array" })
				const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
				const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

				// Convert to structured data
				const headers = (jsonData as any[])[0] ?? []
				const records = (jsonData as any[])
					.slice(1) // skip header row
					.map((row) =>
						headers.reduce(
							(obj: Record<string, any>, h: string, idx: number) => {
								obj[h] = row[idx] // map cell → corresponding header
								return obj
							},
							{} as Record<string, any>
						)
					)

				resolve({
					data: records,
					base64Data: base64Data,
				})
			} catch (error) {
				reject(error)
			}
		}

		reader.onerror = () => {
			reject(new Error("Failed to read file"))
		}

		reader.readAsDataURL(file)
	})
}

// Convert data back to base64 for API calls
export const dataToBase64 = (data: any[]): string => {
	// Create a simple CSV-like structure for the API
	const headers = Object.keys(data[0] || {})
	const csvData = [
		headers,
		...data.map((row) => headers.map((header) => row[header])),
	]

	// Convert to base64
	const csvString = csvData.map((row) => row.join(",")).join("\n")
	return btoa(csvString)
}
