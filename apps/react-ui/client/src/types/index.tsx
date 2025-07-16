import CONST from "@src/CONST"

/**
 * Parameters for running the MAIVE model
 */
interface ModelParameters {
	modelType: (typeof CONST.MODEL_TYPES)[keyof typeof CONST.MODEL_TYPES]
	includeStudyDummies: boolean
	includeStudyClustering: boolean
	standardErrorTreatment:
		| (typeof CONST.STANDARD_ERROR_TREATMENTS)[keyof typeof CONST.STANDARD_ERROR_TREATMENTS]["KEY"]
	computeAndersonRubin: boolean
	maiveMethod: (typeof CONST.MAIVE_METHODS)[keyof typeof CONST.MAIVE_METHODS]
}

export type { ModelParameters }
