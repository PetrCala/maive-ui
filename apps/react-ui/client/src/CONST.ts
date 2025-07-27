const CONST = {
	MAIVE_URL: "https://meta-analysis.cz/maive/",
	MAIVE_PAPER_URL: "https://meta-analysis.cz/maive/maive.pdf",
	MAIVE_GITHUB_URL: "https://github.com/meta-analysis-es/maive",
	APP_DISPLAY_NAME: "MAIVE UI",

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
			VALUE: "not_clustered",
			TEXT: "Not Clustered",
		},
		CLUSTERED: {
			VALUE: "clustered",
			TEXT: "Clustered",
		},
		CLUSTERED_CR2: {
			VALUE: "clustered_cr2",
			TEXT: "Clustered using CR2",
		},
		BOOTSTRAP: {
			VALUE: "bootstrap",
			TEXT: "Bootstrap",
		},
	},
	MOCK_DATA_ROWS_MIN: 10,
	MOCK_DATA_ROWS_MAX: 200,
} as const

export default CONST
