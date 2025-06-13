/// <reference types="vitest" />
import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom"
import { generateMockResults } from "@/utils/mockData"

describe("Placeholder test", () => {
	it("should pass", () => {
		expect(true).toBe(true)
	})
})

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
