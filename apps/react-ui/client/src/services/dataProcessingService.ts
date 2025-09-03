import { useDataStore, dataCache, type UploadedData } from "@store/dataStore";
import { generateDataId, processUploadedFile } from "@utils/dataUtils";
import { mockCsvFiles } from "@utils/mockCsvFiles";
import { generateMockCSVFile } from "@utils/mockData";

/**
 * Unified service for processing data files (uploaded or mock)
 */
export class DataProcessingService {
  /**
   * Process an uploaded file and return structured data
   * @param file - The uploaded file to process
   * @returns Promise<UploadedData> - The processed data
   */
  static async processUploadedFile(file: File): Promise<UploadedData> {
    // Process the uploaded file
    const { data, base64Data } = await processUploadedFile(file);

    // Generate unique ID for this data
    const dataId = generateDataId();

    // Create the uploaded data object
    const uploadedData: UploadedData = {
      id: dataId,
      filename: file.name,
      data: data,
      base64Data: base64Data,
      uploadedAt: new Date(),
    };

    return uploadedData;
  }

  /**
   * Load a specific mock dataset by name
   * @param mockDataName - The name of the mock dataset (e.g., "Mock Data 7")
   * @returns Promise<UploadedData> - The processed mock data
   */
  static async loadMockDataByName(mockDataName: string): Promise<UploadedData> {
    const mockDataIndex = mockCsvFiles.findIndex(
      (file) => file.name === mockDataName,
    );
    const mockData = mockCsvFiles[mockDataIndex];

    if (!mockData) {
      throw new Error(`Mock dataset "${mockDataName}" not found`);
    }

    // Create a File object from the mock data
    const blob = new Blob([mockData.content], { type: "text/csv" });
    const file = new File([blob], mockData.filename, { type: "text/csv" });

    // Process the file using the same logic as uploaded files
    return this.processUploadedFile(file);
  }

  /**
   * Load a random mock dataset
   * @returns Promise<UploadedData> - The processed random mock data
   */
  static async loadRandomMockData(): Promise<UploadedData> {
    const randomIndex = Math.floor(Math.random() * mockCsvFiles.length);
    const randomMockData = mockCsvFiles[randomIndex];

    if (!randomMockData) {
      throw new Error("No mock datasets available");
    }

    // Create a File object from the mock data
    const blob = new Blob([randomMockData.content], { type: "text/csv" });
    const file = new File([blob], randomMockData.filename, {
      type: "text/csv",
    });

    // Process the file using the same logic as uploaded files
    return this.processUploadedFile(file);
  }

  /**
   * Generate and load dynamically created mock data
   * @returns Promise<UploadedData> - The processed generated mock data
   */
  static async loadGeneratedMockData(): Promise<UploadedData> {
    const mockFile = generateMockCSVFile();
    return this.processUploadedFile(mockFile);
  }

  /**
   * Store processed data in the data store and cache
   * @param uploadedData - The processed data to store
   */
  static storeData(uploadedData: UploadedData): void {
    const { setUploadedData } = useDataStore.getState();

    // Store in Zustand store and cache
    setUploadedData(uploadedData);
    dataCache.set(uploadedData.id, uploadedData);
  }

  /**
   * Process and store data, then return the data ID for navigation
   * @param file - The file to process (uploaded or mock)
   * @returns Promise<string> - The data ID for navigation
   */
  static async processAndStoreFile(file: File): Promise<string> {
    const uploadedData = await this.processUploadedFile(file);
    this.storeData(uploadedData);
    return uploadedData.id;
  }

  /**
   * Process and store mock data by name, then return the data ID for navigation
   * @param mockDataName - The name of the mock dataset
   * @returns Promise<string> - The data ID for navigation
   */
  static async processAndStoreMockDataByName(
    mockDataName: string,
  ): Promise<string> {
    const uploadedData = await this.loadMockDataByName(mockDataName);
    this.storeData(uploadedData);
    return uploadedData.id;
  }

  /**
   * Process and store random mock data, then return the data ID for navigation
   * @returns Promise<string> - The data ID for navigation
   */
  static async processAndStoreRandomMockData(): Promise<string> {
    const uploadedData = await this.loadRandomMockData();
    this.storeData(uploadedData);
    return uploadedData.id;
  }

  /**
   * Process and store generated mock data, then return the data ID for navigation
   * @returns Promise<string> - The data ID for navigation
   */
  static async processAndStoreGeneratedMockData(): Promise<string> {
    const uploadedData = await this.loadGeneratedMockData();
    this.storeData(uploadedData);
    return uploadedData.id;
  }

  /**
   * Get available mock dataset names
   * @returns string[] - Array of mock dataset names
   */
  static getAvailableMockDatasets(): string[] {
    return mockCsvFiles.map((file) => file.name);
  }
}
