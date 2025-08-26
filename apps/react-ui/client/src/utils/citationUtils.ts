export const CITATION_TEXT = {
  short: "Irsova et al., Nature Communications, 2025",
  full: "Irsova, Z., Bom, P. R. D., Havranek, T., & Rachinger, H. Spurious Precision in Meta-Analysis of Observational Research. Nature Communications 2025, DOI: 10.1038/s41467-025-63261-0.",
  apa: "Irsova, Z., Bom, P. R. D., Havranek, T., & Rachinger, H. (2025). Spurious Precision in Meta-Analysis of Observational Research. Nature Communications, DOI: 10.1038/s41467-025-63261-0.",
  bibtex: `@article{irsova2025spurious,
  title={Spurious Precision in Meta-Analysis of Observational Research},
  author={Irsova, Zuzana and Bom, Pedro R. D. and Havranek, Tomas and Rachinger, Heiko},
  journal={Nature Communications},
  year={2025},
  doi={10.1038/s41467-025-63261-0}
}`,
  ris: `TY  - JOUR
TI  - Spurious Precision in Meta-Analysis of Observational Research
AU  - Irsova, Zuzana
AU  - Bom, Pedro R. D.
AU  - Havranek, Tomas
AU  - Rachinger, Heiko
PY  - 2025
JO  - Nature Communications
DO  - 10.1038/s41467-025-63261-0
ER  -`,
};

export const CITATION_FOOTER = `\n\nCitation: ${CITATION_TEXT.short}`;

/**
 * Adds a citation footer to CSV data
 */
export const addCitationFooterToCSV = (csvContent: string): string => {
  return csvContent + CITATION_FOOTER;
};

/**
 * Adds a citation footer to text content
 */
export const addCitationFooterToText = (textContent: string): string => {
  return textContent + CITATION_FOOTER;
};

/**
 * Generates a citation reminder for PET/PEESE/EK outputs
 */
export const getCitationReminder = (method: string): string => {
  return `These methods are included in the MAIVE app (${CITATION_TEXT.short}). Please cite the paper if you use this tool.`;
};

/**
 * Copies text to clipboard with fallback for older browsers
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
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
