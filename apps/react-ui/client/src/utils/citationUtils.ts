import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types";

type CitationFormat = "apa" | "bibtex" | "ris" | "plain";

type Citation = {
  /** Stable key, used for copy-state bookkeeping in the UI. */
  key: string;
  /**
   * Why this reference is listed ("Method", "Software", "Application").
   * Omitted when a single citation covers everything, in which case the UI
   * renders a plain "Citation:" label.
   */
  role?: string;
  /** One-line form for the compact citation box. */
  shortText: string;
  url: string;
  formats: Record<CitationFormat, string>;
};

const MAIVE_PAPER: Citation = {
  key: "maive",
  shortText: "Irsova et al., Nature Communications, 2025.",
  url: CONST.LINKS.MAIVE.PAPER,
  formats: {
    apa: "Irsova, Z., Bom, P.R.D., Havranek, T., & Rachinger, H. (2025). Spurious precision in meta-analysis of observational research. Nature Communications, 16, 8454. https://doi.org/10.1038/s41467-025-63261-0",
    bibtex: `@article{irsova2025spurious,
  title={Spurious precision in meta-analysis of observational research},
  author={Irsova, Zuzana and Bom, Pedro R. D. and Havranek, Tomas and Rachinger, Heiko},
  journal={Nature Communications},
  volume={16},
  pages={8454},
  year={2025},
  doi={10.1038/s41467-025-63261-0},
  url={https://doi.org/10.1038/s41467-025-63261-0}
}`,
    ris: `TY  - JOUR
TI  - Spurious precision in meta-analysis of observational research
AU  - Irsova, Zuzana
AU  - Bom, Pedro R. D.
AU  - Havranek, Tomas
AU  - Rachinger, Heiko
PY  - 2025
JO  - Nature Communications
VL  - 16
SP  - 8454
DO  - 10.1038/s41467-025-63261-0
UR  - https://doi.org/10.1038/s41467-025-63261-0
ER  -`,
    plain:
      "Irsova, Z., Bom, P.R.D., Havranek, T., & Rachinger, H. (2025). Spurious precision in meta-analysis of observational research. Nature Communications 16, 8454. https://doi.org/10.1038/s41467-025-63261-0",
  },
};

// The published RTMA article, not the OSF preprint it superseded (see #482).
const RTMA_PAPER: Citation = {
  key: "rtma",
  shortText: "Mathur, Research Synthesis Methods, 2024.",
  url: CONST.LINKS.RTMA.PAPER,
  formats: {
    apa: "Mathur, M. B. (2024). P-hacking in meta-analyses: A formalization and new meta-analytic methods. Research Synthesis Methods, 15(3), 483-499. https://doi.org/10.1002/jrsm.1701",
    bibtex: `@article{mathur2024phacking,
  title={P-hacking in meta-analyses: A formalization and new meta-analytic methods},
  author={Mathur, Maya B.},
  journal={Research Synthesis Methods},
  volume={15},
  number={3},
  pages={483--499},
  year={2024},
  doi={10.1002/jrsm.1701},
  url={https://doi.org/10.1002/jrsm.1701}
}`,
    ris: `TY  - JOUR
TI  - P-hacking in meta-analyses: A formalization and new meta-analytic methods
AU  - Mathur, Maya B.
PY  - 2024
JO  - Research Synthesis Methods
VL  - 15
IS  - 3
SP  - 483
EP  - 499
DO  - 10.1002/jrsm.1701
UR  - https://doi.org/10.1002/jrsm.1701
ER  -`,
    plain:
      "Mathur, M. B. (2024). P-hacking in meta-analyses: A formalization and new meta-analytic methods. Research Synthesis Methods 15(3), 483-499. https://doi.org/10.1002/jrsm.1701",
  },
};

const PHACKING_PACKAGE: Citation = {
  key: "phacking",
  shortText: "Mathur & Braginsky, phacking R package, 2023.",
  url: CONST.LINKS.RTMA.PHACKING_CRAN,
  formats: {
    apa: "Mathur, M., & Braginsky, M. (2023). phacking: Sensitivity Analysis for p-Hacking in Meta-Analyses. R package version 0.2.1. https://doi.org/10.32614/CRAN.package.phacking",
    bibtex: `@manual{mathur2023phacking,
  title={phacking: Sensitivity Analysis for p-Hacking in Meta-Analyses},
  author={Mathur, Maya and Braginsky, Mika},
  year={2023},
  note={R package version 0.2.1},
  doi={10.32614/CRAN.package.phacking},
  url={https://doi.org/10.32614/CRAN.package.phacking}
}`,
    ris: `TY  - COMP
TI  - phacking: Sensitivity Analysis for p-Hacking in Meta-Analyses
AU  - Mathur, Maya
AU  - Braginsky, Mika
PY  - 2023
N1  - R package version 0.2.1
DO  - 10.32614/CRAN.package.phacking
UR  - https://doi.org/10.32614/CRAN.package.phacking
ER  -`,
    plain:
      "Mathur, M., & Braginsky, M. (2023). phacking: Sensitivity Analysis for p-Hacking in Meta-Analyses. R package version 0.2.1. https://doi.org/10.32614/CRAN.package.phacking",
  },
};

// The method papers behind a conventional (WLS) run (#597): PET, PEESE and
// PET-PEESE are Stanley & Doucouliagos's, the endogenous kink is Bom &
// Rachinger's. Neither is MAIVE's, so a WLS run cites them as the method.
const PET_PEESE_PAPER: Citation = {
  key: "petpeese",
  shortText: "Stanley & Doucouliagos, Research Synthesis Methods, 2014.",
  url: CONST.LINKS.PET_PEESE.PAPER,
  formats: {
    apa: "Stanley, T. D., & Doucouliagos, H. (2014). Meta-regression approximations to reduce publication selection bias. Research Synthesis Methods, 5(1), 60-78. https://doi.org/10.1002/jrsm.1095",
    bibtex: `@article{stanley2014meta,
  title={Meta-regression approximations to reduce publication selection bias},
  author={Stanley, Tom D. and Doucouliagos, Hristos},
  journal={Research Synthesis Methods},
  volume={5},
  number={1},
  pages={60--78},
  year={2014},
  doi={10.1002/jrsm.1095}
}`,
    ris: `TY  - JOUR
TI  - Meta-regression approximations to reduce publication selection bias
AU  - Stanley, Tom D.
AU  - Doucouliagos, Hristos
PY  - 2014
JO  - Research Synthesis Methods
VL  - 5
IS  - 1
SP  - 60
EP  - 78
DO  - 10.1002/jrsm.1095
UR  - https://doi.org/10.1002/jrsm.1095
ER  -`,
    plain:
      "Stanley, T. D., & Doucouliagos, H. (2014). Meta-regression approximations to reduce publication selection bias. Research Synthesis Methods 5(1), 60-78. https://doi.org/10.1002/jrsm.1095",
  },
};

const EK_PAPER: Citation = {
  key: "ek",
  shortText: "Bom & Rachinger, Research Synthesis Methods, 2019.",
  url: CONST.LINKS.EK.PAPER,
  formats: {
    apa: "Bom, P. R. D., & Rachinger, H. (2019). A kinked meta-regression model for publication bias correction. Research Synthesis Methods, 10(4), 497-514. https://doi.org/10.1002/jrsm.1352",
    bibtex: `@article{bom2019kinked,
  title={A kinked meta-regression model for publication bias correction},
  author={Bom, Pedro R. D. and Rachinger, Heiko},
  journal={Research Synthesis Methods},
  volume={10},
  number={4},
  pages={497--514},
  year={2019},
  doi={10.1002/jrsm.1352}
}`,
    ris: `TY  - JOUR
TI  - A kinked meta-regression model for publication bias correction
AU  - Bom, Pedro R. D.
AU  - Rachinger, Heiko
PY  - 2019
JO  - Research Synthesis Methods
VL  - 10
IS  - 4
SP  - 497
EP  - 514
DO  - 10.1002/jrsm.1352
UR  - https://doi.org/10.1002/jrsm.1352
ER  -`,
    plain:
      "Bom, P. R. D., & Rachinger, H. (2019). A kinked meta-regression model for publication bias correction. Research Synthesis Methods 10(4), 497-514. https://doi.org/10.1002/jrsm.1352",
  },
};

/**
 * Citations to show for a finished model run. RTMA runs Mathur's method, so
 * the method citation comes first and the MAIVE app is credited as the
 * application. A WLS run is the conventional estimator, so it credits the
 * method paper the same way (Stanley & Doucouliagos for PET, PEESE and
 * PET-PEESE, Bom & Rachinger for EK; PET-PEESE when no method is given) with
 * the MAIVE app as the application (#597). MAIVE and WAIVE are the MAIVE
 * paper's own method. RDT is an unpublished, different method (#559): it has
 * no citation entry, and the MAIVE paper must not be attached to its results.
 */
function getCitationsForModel(
  modelType?: ModelParameters["modelType"],
  maiveMethod?: ModelParameters["maiveMethod"],
): Citation[] {
  if (modelType === "RDT") {
    return [];
  }
  if (modelType === "RTMA") {
    return [
      { ...RTMA_PAPER, role: "Method" },
      { ...PHACKING_PACKAGE, role: "Software" },
      { ...MAIVE_PAPER, role: "Application" },
    ];
  }
  if (modelType === "WLS") {
    const method = maiveMethod === "EK" ? EK_PAPER : PET_PEESE_PAPER;
    return [
      { ...method, role: "Method" },
      { ...MAIVE_PAPER, role: "Application" },
    ];
  }
  return [MAIVE_PAPER];
}

/**
 * Citations for the public API docs, which advertise every model family.
 */
const API_DOCS_CITATIONS: Citation[] = [
  {
    ...MAIVE_PAPER,
    role: "MAIVE and WAIVE models; application for WLS and RTMA",
  },
  { ...PET_PEESE_PAPER, role: "WLS model with PET, PEESE or PET-PEESE" },
  { ...EK_PAPER, role: "WLS model with EK" },
  { ...RTMA_PAPER, role: "RTMA model" },
  { ...PHACKING_PACKAGE, role: "RTMA software" },
];

/**
 * Copies text to clipboard with fallback for older browsers
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
};

export { getCitationsForModel, API_DOCS_CITATIONS, copyToClipboard };
export type { Citation, CitationFormat };
