import { describe, it, expect } from "vitest";
import { mockCsvFiles, getRandomMockCsvFile } from "@src/utils/mockCsvFiles";

describe("Mock CSV Files", () => {
  describe("mockCsvFiles array", () => {
    it("should contain at least one mock CSV file", () => {
      expect(mockCsvFiles).toBeDefined();
      expect(Array.isArray(mockCsvFiles)).toBe(true);
      expect(mockCsvFiles.length).toBeGreaterThan(0);
    });

    it("should have all required properties for each CSV file", () => {
      mockCsvFiles.forEach((csvFile) => {
        expect(csvFile).toHaveProperty("name");
        expect(csvFile).toHaveProperty("content");
        expect(csvFile).toHaveProperty("filename");
        expect(csvFile).toHaveProperty("original_filename");

        expect(typeof csvFile.name).toBe("string");
        expect(typeof csvFile.content).toBe("string");
        expect(typeof csvFile.filename).toBe("string");
        expect(typeof csvFile.original_filename).toBe("string");
      });
    });

    it("should have non-empty content for each CSV file", () => {
      mockCsvFiles.forEach((csvFile, index) => {
        expect(
          csvFile.content.trim(),
          `CSV file at index ${index} should have non-empty content`,
        ).not.toBe("");
        expect(
          csvFile.name.trim(),
          `CSV file at index ${index} should have non-empty name`,
        ).not.toBe("");
        expect(
          csvFile.filename.trim(),
          `CSV file at index ${index} should have non-empty filename`,
        ).not.toBe("");
        expect(
          csvFile.original_filename.trim(),
          `CSV file at index ${index} should have non-empty original_filename`,
        ).not.toBe("");
      });
    });
  });

  describe("CSV content structure", () => {
    it("should parse each CSV into exactly 4 columns", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");

        lines.forEach((line, lineIndex) => {
          const columns = line.split(",");
          expect(
            columns.length,
            `CSV file "${csvFile.name}" line ${lineIndex + 1} should have exactly 4 columns, but has ${columns.length}`,
          ).toBe(4);
        });
      });
    });

    it("should have valid numeric values in first three columns", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");

        lines.forEach((line, lineIndex) => {
          const columns = line.split(",");

          // First column (effect size) should be a valid number
          const effectSize = parseFloat(columns[0]);
          expect(
            !isNaN(effectSize),
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: first column should be a valid number, got "${columns[0]}"`,
          ).toBe(true);

          // Second column (standard error) should be a valid positive number
          const standardError = parseFloat(columns[1]);
          expect(
            !isNaN(standardError) && standardError > 0,
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: second column should be a valid positive number, got "${columns[1]}"`,
          ).toBe(true);

          // Third column (sample size) should be a valid positive integer
          const sampleSize = parseInt(columns[2], 10);
          expect(
            !isNaN(sampleSize) &&
              sampleSize > 0 &&
              Number.isInteger(sampleSize),
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: third column should be a valid positive integer, got "${columns[2]}"`,
          ).toBe(true);
        });
      });
    });

    it("should have non-empty study identifiers in the fourth column", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");

        lines.forEach((line, lineIndex) => {
          const columns = line.split(",");
          const studyId = columns[3].trim();

          expect(
            studyId.length > 0,
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: fourth column should have a non-empty study identifier, got "${studyId}"`,
          ).toBe(true);
        });
      });
    });
  });

  describe("Study column validation", () => {
    it("should have at least 3 more items than unique studies in each CSV (where applicable)", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");
        const studyIds = lines.map((line) => line.split(",")[3].trim());
        const uniqueStudyIds = new Set(studyIds);

        const totalItems = studyIds.length;
        const uniqueItems = uniqueStudyIds.size;
        const difference = totalItems - uniqueItems;

        expect(
          difference >= 3,
          `CSV file "${csvFile.name}" should have at least 3 more items than unique studies. ` +
            `Found ${totalItems} total items and ${uniqueItems} unique studies (difference: ${difference})`,
        ).toBe(true);
      });
    });

    it("should have reasonable distribution of studies (not all same study)", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");
        const studyIds = lines.map((line) => line.split(",")[3].trim());
        const uniqueStudyIds = new Set(studyIds);

        const totalItems = studyIds.length;
        const uniqueItems = uniqueStudyIds.size;

        // Should not have all same study (would make uniqueItems = 1)
        expect(
          uniqueItems > 1,
          `CSV file "${csvFile.name}" should have more than 1 unique study (found ${uniqueItems} unique studies)`,
        ).toBe(true);

        // Should have a reasonable number of studies relative to total items
        expect(
          uniqueItems >= Math.min(2, Math.floor(totalItems / 10)),
          `CSV file "${csvFile.name}" should have a reasonable number of studies (${uniqueItems} unique out of ${totalItems} total)`,
        ).toBe(true);
      });
    });

    it("should provide detailed study statistics for analysis", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");
        const studyIds = lines.map((line) => line.split(",")[3].trim());
        const uniqueStudyIds = new Set(studyIds);

        const totalItems = studyIds.length;
        const uniqueItems = uniqueStudyIds.size;
        const difference = totalItems - uniqueItems;
        const repetitionRate = (difference / totalItems) * 100;

        // Log statistics for each file (useful for understanding the data)
        console.log(`\n${csvFile.name} (${csvFile.original_filename}):`);
        console.log(`  Total items: ${totalItems}`);
        console.log(`  Unique studies: ${uniqueItems}`);
        console.log(`  Repetition difference: ${difference}`);
        console.log(`  Repetition rate: ${repetitionRate.toFixed(1)}%`);

        // Basic validation that we have meaningful data
        expect(totalItems).toBeGreaterThan(0);
        expect(uniqueItems).toBeGreaterThan(0);
        expect(uniqueItems).toBeLessThanOrEqual(totalItems);
      });
    });
  });

  describe("Data quality checks", () => {
    it("should have reasonable effect size values", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");

        lines.forEach((line, lineIndex) => {
          const effectSize = parseFloat(line.split(",")[0]);

          // Effect sizes should be reasonable (not extremely large)
          expect(
            Math.abs(effectSize) < 100,
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: effect size should be reasonable, got ${effectSize}`,
          ).toBe(true);
        });
      });
    });

    it("should have reasonable sample sizes", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");

        lines.forEach((line, lineIndex) => {
          const sampleSize = parseInt(line.split(",")[2], 10);

          // Sample sizes should be reasonable (not too small, not extremely large)
          expect(
            sampleSize >= 5 && sampleSize <= 100000,
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: sample size should be between 5 and 100000, got ${sampleSize}`,
          ).toBe(true);
        });
      });
    });

    it("should have reasonable standard errors", () => {
      mockCsvFiles.forEach((csvFile) => {
        const lines = csvFile.content.trim().split("\n");

        lines.forEach((line, lineIndex) => {
          const standardError = parseFloat(line.split(",")[1]);

          // Standard errors should be reasonable (positive and not extremely large)
          expect(
            standardError > 0 && standardError < 100,
            `CSV file "${csvFile.name}" line ${lineIndex + 1}: standard error should be between 0 and 100, got ${standardError}`,
          ).toBe(true);
        });
      });
    });
  });

  describe("getRandomMockCsvFile function", () => {
    it("should return a valid CSV file object", () => {
      const randomFile = getRandomMockCsvFile();

      expect(randomFile).toBeDefined();
      expect(randomFile).toHaveProperty("name");
      expect(randomFile).toHaveProperty("content");
      expect(randomFile).toHaveProperty("filename");
      expect(randomFile).toHaveProperty("original_filename");
    });

    it("should return different files on multiple calls (with high probability)", () => {
      const calls = 10;
      const results = new Set();

      for (let i = 0; i < calls; i++) {
        const randomFile = getRandomMockCsvFile();
        results.add(randomFile.filename);
      }

      // With multiple files available, we should get some variety
      // This test might occasionally fail due to randomness, but it's very unlikely
      expect(results.size).toBeGreaterThan(1);
    });

    it("should return a file that exists in the mockCsvFiles array", () => {
      const randomFile = getRandomMockCsvFile();
      const foundInArray = mockCsvFiles.some(
        (file) =>
          file.filename === randomFile.filename &&
          file.name === randomFile.name &&
          file.content === randomFile.content,
      );

      expect(foundInArray).toBe(true);
    });
  });

  describe("CSV file uniqueness", () => {
    it("should have unique filenames", () => {
      const filenames = mockCsvFiles.map((file) => file.filename);
      const uniqueFilenames = new Set(filenames);

      expect(uniqueFilenames.size).toBe(filenames.length);
    });

    it("should have unique names", () => {
      const names = mockCsvFiles.map((file) => file.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it("should have unique original filenames", () => {
      const originalFilenames = mockCsvFiles.map(
        (file) => file.original_filename,
      );
      const uniqueOriginalFilenames = new Set(originalFilenames);

      expect(uniqueOriginalFilenames.size).toBe(originalFilenames.length);
    });
  });
});
