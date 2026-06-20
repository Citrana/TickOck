'use client';

import {useState, useEffect} from 'react';
import Pagination from './Pagination';

export type ColumnDef<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  pageSize?: number;
  emptyMessage: string;
  renderActions?: (row: T) => React.ReactNode;
  getRowKey: (row: T) => string;
  getRowClassName?: (row: T) => string;
  previousLabel: string;
  nextLabel: string;
  formatResults: (from: number, to: number, total: number) => string;
};

export default function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  emptyMessage,
  renderActions,
  getRowKey,
  getRowClassName,
  previousLabel,
  nextLabel,
  formatResults,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);

  // Reset to first page whenever the filtered dataset size changes
  useEffect(() => {
    setPage(1);
  }, [data.length]);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">{emptyMessage}</p>
    );
  }

  const pageData = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
            {renderActions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pageData.map(row => (
            <tr
              key={getRowKey(row)}
              className={`transition-colors hover:bg-gray-50 ${getRowClassName?.(row) ?? ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 ${col.cellClassName ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
              {renderActions && (
                <td className="px-4 py-3 text-right">{renderActions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={data.length}
        onPageChange={setPage}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        formatResults={formatResults}
      />
    </div>
  );
}
