import { faker } from "@faker-js/faker"

export const generateMockResults = () => {
	// Generate a simple funnel plot using a canvas
	const canvas = document.createElement("canvas")
	canvas.width = 400
	canvas.height = 300
	const ctx = canvas.getContext("2d")
	if (ctx) {
		ctx.fillStyle = "white"
		ctx.fillRect(0, 0, canvas.width, canvas.height)
		ctx.strokeStyle = "black"
		ctx.beginPath()
		ctx.moveTo(200, 0)
		ctx.lineTo(200, 300)
		ctx.moveTo(0, 150)
		ctx.lineTo(400, 150)
		ctx.stroke()
	}
	const funnelPlotBase64 = canvas.toDataURL("image/png")?.split(",")[1] ?? ""

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
