const CONST = {
	MAIVE_URL: "https://meta-analysis.cz/maive/",
	MAIVE_PAPER_URL: "https://meta-analysis.cz/maive/maive.pdf",
	MAIVE_GITHUB_URL: "https://github.com/meta-analysis-es/maive",

	MODEL_TYPES: {
		MAIVE: "MAIVE",
		WAIVE: "WAIVE",
	},
	MAIVE_METHODS: {
		PET: "PET",
		PEESE: "PEESE",
		PET_PEESE: "PET-PEESE",
		EK: "EK",
	},
	STANDARD_ERROR_TREATMENTS: {
		NOT_CLUSTERED: {
			KEY: "not_clustered",
			LABEL: "Not Clustered",
		},
		CLUSTERED: {
			KEY: "clustered",
			LABEL: "Clustered",
		},
		CLUSTERED_CR2: {
			KEY: "clustered_cr2",
			LABEL: "Clustered using CR2",
		},
		BOOTSTRAP: {
			KEY: "bootstrap",
			LABEL: "Bootstrap",
		},
	},
} as const

export default CONST
