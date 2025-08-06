interface RowInfoComponentProps {
  rowCount: number;
  showFirstRows: boolean;
  rowCountToShow: number;
}

/**
 * @param rowCount - The number of rows in the data
 * @param showFirstRows - Whether to show the first 4 rows
 * @returns A component that displays the row count and, if showFirstRows is true, the first 4 rows
 */
function RowInfoComponent({
  rowCount,
  showFirstRows = false,
  rowCountToShow = 4,
}: RowInfoComponentProps) {
  return (
    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">Total rows:</span> {rowCount || 0}
        {showFirstRows && (
          <span className="text-gray-500 dark:text-gray-400">
            {" "}
            (showing first {rowCountToShow} rows)
          </span>
        )}
      </p>
    </div>
  );
}

export default RowInfoComponent;
