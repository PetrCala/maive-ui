import { useDataStore, dataCache, type UploadedData } from "@store/dataStore";
import { generateDataId, processUploadedFile } from "@utils/dataUtils";
import { mockCsvFiles } from "@utils/mockCsvFiles";

/**
 * Service for handling demo data operations
 */
export class DemoService {
  /**
   * Load mock dataset 7 and process it as if it was uploaded
   * @returns Promise<UploadedData> - The processed demo data
   */
  static async loadDemoData(): Promise<UploadedData> {
    const mockData7Index = mockCsvFiles.findIndex(
      (file) => file.name === "Mock Data 7",
    );
    const mockData7 = mockCsvFiles[mockData7Index];

    if (!mockData7) {
      throw new Error("Mock dataset 7 not found");
    }

    // Create a File object from the mock data
    const blob = new Blob([mockData7.content], { type: "text/csv" });
    const file = new File([blob], mockData7.filename, { type: "text/csv" });

    // Process the file using the same logic as the upload page
    const { data, base64Data } = await processUploadedFile(file);

    // Generate unique ID for this data
    const dataId = generateDataId();

    // Create the uploaded data object
    const uploadedData: UploadedData = {
      id: dataId,
      filename: mockData7.filename,
      data: data,
      base64Data: base64Data,
      uploadedAt: new Date(),
    };

    return uploadedData;
  }

  /**
   * Store demo data in the data store and cache
   * @param uploadedData - The demo data to store
   */
  static storeDemoData(uploadedData: UploadedData): void {
    const { setUploadedData } = useDataStore.getState();

    // Store in Zustand store and cache
    setUploadedData(uploadedData);
    dataCache.set(uploadedData.id, uploadedData);
  }

  /**
   * Load and store demo data, then return the data ID for navigation
   * @returns Promise<string> - The data ID for navigation
   */
  static async loadAndStoreDemoData(): Promise<string> {
    const uploadedData = await this.loadDemoData();
    this.storeDemoData(uploadedData);
    return uploadedData.id;
  }
}
