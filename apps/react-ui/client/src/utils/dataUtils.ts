import * as XLSX from "xlsx"
import { faker } from "@faker-js/faker"

// Generate a unique ID for uploaded data
export const generateDataId = (): string => {
	return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Generate mock CSV data for development
export const generateMockCSVFile = (): File => {
	// Generate 10-20 rows of realistic data
	const numRows = faker.number.int({ min: 10, max: 20 })

	// Create CSV content
	const headers = ["effect", "se", "n_obs", "study_id"]
	const csvRows = [headers.join(",")]

	for (let i = 0; i < numRows; i++) {
		const effect = faker.number.float({ min: -2, max: 2, multipleOf: 0.001 })
		const se = faker.number.float({ min: 0.01, max: 0.5, multipleOf: 0.001 })
		const nObs = faker.number.int({ min: 50, max: 1000 })
		const studyId = i + 1

		csvRows.push(`${effect},${se},${nObs},${studyId}`)
	}

	const csvContent = csvRows.join("\n")
	const blob = new Blob([csvContent], { type: "text/csv" })

	return new File([blob], "mock_data.csv", { type: "text/csv" })
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
