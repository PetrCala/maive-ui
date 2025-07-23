import { faker } from "@faker-js/faker"
import mockFunnelPlot from "./mockFunnelPlot"
import CONST from "@src/CONST"

// Generate mock CSV data for development
const generateMockCSVFile = (): File => {
	// Generate 10-2000 rows of realistic data
	const numRows = faker.number.int({ min: CONST.MOCK_DATA_ROWS_MIN, max: CONST.MOCK_DATA_ROWS_MAX })

	// Create CSV content
	const headers = ["effect", "se", "n_obs", "study_id"]
	const csvRows = [headers.join(",")]

	for (let i = 0; i < numRows; i++) {
		const effect = faker.number.float({ min: -2, max: 2, multipleOf: 0.001 })
		const se = faker.number.float({ min: 0.01, max: 0.5, multipleOf: 0.001 })
		const nObs = faker.number.int({ min: 50, max: 10000 })
		const studyId = Math.floor(i / 5) + 1

		csvRows.push(`${effect},${se},${nObs},${studyId}`)
	}

	const csvContent = csvRows.join("\n")
	const blob = new Blob([csvContent], { type: "text/csv" })

	return new File([blob], "mock_data.csv", { type: "text/csv" })
}

/**
 * Generate mock results for a given number of rows.
 * @param nrow - The number of rows in the data.
 * @returns The mock results.
 */
const generateMockResults = (nrow: number) => {
	const funnelPlotBase64 = mockFunnelPlot

	return {
		effectEstimate: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
		standardError: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
		isSignificant: true,
		andersonRubinCI:
			Math.random() > 0.5
				? [
						faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
						faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
				  ]
				: "NA",
		publicationBias: {
			pValue: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
			isSignificant: faker.datatype.boolean(),
		},
		firstStageFTest:
			Math.random() > 0.5
				? "NA"
				: faker.number.float({
						min: 0,
						max: 100,
						multipleOf: 0.0001,
				  }),
		hausmanTest: {
			statistic: faker.number.float({ min: 0, max: 100, multipleOf: 0.0001 }),
			criticalValue: 3.841,
			rejectsNull: false,
		},
		seInstrumented: Array.from({ length: nrow }, () =>
			faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 })
		),
		funnelPlot: funnelPlotBase64,
	}
}

const shouldUseMockResults = () => {
	return (
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"
	)
}

export { generateMockCSVFile, generateMockResults, shouldUseMockResults }
