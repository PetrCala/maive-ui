import type { ReactNode } from "react";

export type DataPreviewProps = {
  title?: string;
  description?: string;
  headers: string[];
  rows: string[][];
  emptyMessage?: string;
  footer?: ReactNode;
  className?: string;
};

const TableCell = ({ children }: { children: ReactNode }) => (
  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">
    {children}
  </td>
);

export default function DataPreview({
  title,
  description,
  headers,
  rows,
  emptyMessage = "No data to display.",
  footer,
  className = "",
}: DataPreviewProps) {
  const hasData = headers.length > 0 && rows.length > 0;
  const hasHeaderContent = [title, description].some(
    (value) => value !== undefined && value !== null,
  );
  const containerClassName =
    `rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden ${className}`.trim();

  return (
    <div className={containerClassName}>
      {hasHeaderContent && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {description}
            </p>
          )}
        </div>
      )}

      {hasData ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${rowIndex}-${cellIndex}`}>
                      {cell}
                    </TableCell>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
          {emptyMessage}
        </div>
      )}

      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          {footer}
        </div>
      )}
    </div>
  );
}
