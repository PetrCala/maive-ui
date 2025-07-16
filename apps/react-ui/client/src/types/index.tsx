const MODEL_TYPES = ["MAIVE", "WAIVE"] as const
const MAIVE_METHODS = ["PET", "PEESE", "PET-PEESE", "EK"] as const

/**
 * Parameters for running the MAIVE model
 */
interface ModelParameters {
	modelType: (typeof MODEL_TYPES)[number]
	includeStudyDummies: boolean
	includeStudyClustering: boolean
	standardErrorTreatment:
		| "not_clustered"
		| "clustered"
		| "clustered_cr2"
		| "bootstrap"
	computeAndersonRubin: boolean
	maiveMethod: (typeof MAIVE_METHODS)[number]
}

export { MODEL_TYPES, MAIVE_METHODS }
export type { ModelParameters }
