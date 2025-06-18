import { faker } from "@faker-js/faker"
import mockFunnelPlot from "./mockFunnelPlot"

export const generateMockResults = () => {
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
				: undefined,
		publicationBias: {
			estimate: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
			standardError: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
			isSignificant: faker.datatype.boolean(),
		},
		firstStageFTest: faker.number.float({
			min: 0,
			max: 100,
			multipleOf: 0.0001,
		}),
		hausmanTest: {
			statistic: faker.number.float({ min: 0, max: 100, multipleOf: 0.0001 }),
			rejectsNull: false,
		},
		funnelPlot: funnelPlotBase64,
	}
}

export const isDevelopmentMode = () => {
	return (
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"
	)
}
