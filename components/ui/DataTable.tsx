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
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
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
  searchPlaceholder,
  searchFilter,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setPage(1);
  }, [data.length]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const isSearchable = !!searchPlaceholder && !!searchFilter;

  const displayData =
    isSearchable && searchQuery
      ? data.filter(row => searchFilter!(row, searchQuery.toLowerCase()))
      : data;

  // No search and no data — plain empty message, no card
  if (!isSearchable && data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">{emptyMessage}</p>
    );
  }

  const pageData = displayData.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      {/* Search bar — stays fixed, outside the horizontal scroll zone */}
      {isSearchable && (
        <div className="relative border-b border-gray-100 px-4 py-3">
          <svg
            className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-8 text-sm focus:border-gray-900 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {displayData.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <>
          {/* Horizontal scroll only wraps the table */}
          <div className="overflow-x-auto">
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
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={displayData.length}
            onPageChange={setPage}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
            formatResults={formatResults}
          />
        </>
      )}
    </div>
  );
}
