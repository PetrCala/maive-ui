type DataArray = Array<Record<string, unknown>>;

type DataInfo = {
  filename: string;
  rowCount: number;
  hasStudyId: boolean;
  studyCount?: number;
  medianObservationsPerStudy?: number;
};

export default DataArray;
export type { DataInfo };
