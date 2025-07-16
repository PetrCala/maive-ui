import CONST from "@src/CONST"
import DeepValueOf from "./DeepValueOf"

/**
 * Parameters for running the MAIVE model
 */
interface ModelParameters {
	modelType: DeepValueOf<typeof CONST.MODEL_TYPES>
	includeStudyDummies: boolean
	includeStudyClustering: boolean
	standardErrorTreatment: (typeof CONST.STANDARD_ERROR_TREATMENTS)[keyof typeof CONST.STANDARD_ERROR_TREATMENTS]["KEY"]
	computeAndersonRubin: boolean
	maiveMethod: DeepValueOf<typeof CONST.MAIVE_METHODS>
	shouldUseInstrumenting: boolean
}

export type { ModelParameters, DeepValueOf }
