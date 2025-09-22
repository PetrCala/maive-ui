import { faker } from "@faker-js/faker";
import mockFunnelPlot from "./mockFunnelPlot";
import CONST from "@src/CONST";
import { getRandomMockCsvFile } from "./mockCsvFiles";

// Generate mock CSV data for development
const generateMockCSVFile = (): File => {
  // Generate 10-2000 rows of realistic data
  const numRows = faker.number.int({
    min: CONST.MOCK_DATA_ROWS_MIN,
    max: CONST.MOCK_DATA_ROWS_MAX,
  });

  // Create CSV content - no headers, just data rows
  const csvRows: string[] = [];
  const shouldUseNumericStudyIds = faker.datatype.boolean(0.5);

  // Ensure each study has at least 3 observations
  const numStudies = Math.floor(numRows / 3);
  const studyIds = shouldUseNumericStudyIds
    ? Array.from({ length: numStudies }, (_, i) => i + 1)
    : Array.from({ length: numStudies }, (_, i) => `Study_${i + 1}`);

  for (let i = 0; i < numRows; i++) {
    const effect = faker.number.float({ min: -2, max: 2, multipleOf: 0.001 });
    const se = faker.number.float({ min: 0, max: 0.5, multipleOf: 0.001 });
    const nObs = faker.number.int({ min: 50, max: 10000 });
    const studyId = studyIds[Math.floor(i / 3)];

    csvRows.push(`${effect},${se},${nObs},${studyId}`);
  }

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });

  return new File([blob], "mock_data.csv", { type: "text/csv" });
};

// Load a random mock CSV file from the mock-csv-files directory
const loadRandomMockCsvFile = (): File => {
  const randomFile = getRandomMockCsvFile();

  try {
    const blob = new Blob([randomFile.content], { type: "text/csv" });
    return new File([blob], randomFile.filename, { type: "text/csv" });
  } catch (error) {
    console.error("Error loading mock CSV file:", error);
    return generateMockCSVFile();
  }
};

/**
 * Generate mock results for a given number of rows.
 * @param nrow - The number of rows in the data.
 * @returns The mock results.
 */
const generateMockResults = (nrow: number) => {
  const funnelPlotBase64 = mockFunnelPlot;

  return {
    effectEstimate: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
    standardError: faker.number.float({
      min: 0,
      max: 1,
      multipleOf: 0.0001,
    }),
    isSignificant: true,
    andersonRubinCI:
      Math.random() > 0.5
        ? [
            faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
            faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
          ]
        : "NA",
    publicationBias: {
      pValue: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
      eggerCoef: faker.number.float({ min: -2, max: 2, multipleOf: 0.0001 }),
      eggerSE: faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
      isSignificant: faker.datatype.boolean(),
      eggerBootCI:
        Math.random() > 0.5
          ? [
              faker.number.float({ min: -2, max: 2, multipleOf: 0.0001 }),
              faker.number.float({ min: -2, max: 2, multipleOf: 0.0001 }),
            ]
          : "NA",
      eggerAndersonRubinCI:
        Math.random() > 0.5
          ? [
              faker.number.float({ min: -2, max: 2, multipleOf: 0.0001 }),
              faker.number.float({ min: -2, max: 2, multipleOf: 0.0001 }),
            ]
          : "NA",
    },
    firstStageFTest:
      Math.random() > 0.5
        ? "NA"
        : faker.number.float({
            min: 0,
            max: 100,
            multipleOf: 0.0001,
          }),
    hausmanTest: {
      statistic: faker.number.float({ min: 0, max: 100, multipleOf: 0.0001 }),
      criticalValue: 3.841,
      rejectsNull: false,
    },
    seInstrumented: Array.from({ length: nrow }, () =>
      faker.number.float({ min: 0, max: 1, multipleOf: 0.0001 }),
    ),
    funnelPlot: funnelPlotBase64,
    funnelPlotWidth: 672,
    funnelPlotHeight: 672,
  };
};

const shouldUseMockResults = () => {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"
  );
};

export {
  generateMockCSVFile,
  generateMockResults,
  shouldUseMockResults,
  loadRandomMockCsvFile,
};
