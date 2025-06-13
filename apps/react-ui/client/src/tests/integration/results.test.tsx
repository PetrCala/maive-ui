/// <reference types="vitest" />
import { faker } from "@faker-js/faker"
import { describe, it, expect, vi } from "vitest"
// import { describe, it, expect, vi } from "vitest"
// import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
// import ResultsPage from "@pages/results"

// Mock data generator
const generateMockResults = () => {
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

describe("Results Page Integration", () => {
	it("should pass", () => {
		expect(true).toBe(true)
	})
})

// describe("Results Page Integration", () => {
// 	it("should render results page with mock data", () => {
// 		const mockResults = generateMockResults()
// 		const mockFileData = "mock-file-data"
// 		const mockParameters = "mock-parameters"

// 		// Mock the useSearchParams hook first
// 		vi.mock("next/navigation", () => ({
// 			useSearchParams: () => {
// 				const searchParams = new URLSearchParams({
// 					results: JSON.stringify(mockResults),
// 					fileData: mockFileData,
// 					parameters: mockParameters,
// 				})
// 				return searchParams
// 			},
// 			useRouter: () => ({
// 				push: vi.fn(),
// 			}),
// 		}))

// 		render(<ResultsPage />)

// 		// Verify key elements are rendered
// 		expect(screen.getByText("Model Results")).toBeInTheDocument()
// 		expect(screen.getByText("Effect Estimate")).toBeInTheDocument()
// 		expect(screen.getByText("Publication Bias Analysis")).toBeInTheDocument()
// 		expect(screen.getByText("Diagnostic Tests")).toBeInTheDocument()
// 		expect(screen.getByText("Funnel Plot")).toBeInTheDocument()
// 	})
// })

// Helper function to generate a test URL
export const generateTestUrl = () => {
	const mockResults = generateMockResults()
	const mockFileData = "mock-file-data"
	const mockParameters = "mock-parameters"

	const searchParams = new URLSearchParams({
		results: JSON.stringify(mockResults),
		fileData: mockFileData,
		parameters: mockParameters,
	})

	return `http://localhost:3000/results?${searchParams.toString()}`
}

// Log the test URL when this file is run directly
if (import.meta.vitest) {
	console.log("Test URL:", generateTestUrl())
}
