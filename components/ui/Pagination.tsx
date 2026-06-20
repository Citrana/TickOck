'use client';

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  formatResults: (from: number, to: number, total: number) => string;
};

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  previousLabel,
  nextLabel,
  formatResults,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function getPages(): (number | 'ellipsis-start' | 'ellipsis-end')[] {
    if (totalPages <= 5) {
      return Array.from({length: totalPages}, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [1];
    if (page > 3) pages.push('ellipsis-start');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  }

  const pillBase =
    'rounded-full px-3 py-1 text-xs font-medium transition-colors';

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
      <span className="text-xs text-gray-500">{formatResults(from, to, total)}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${pillBase} bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {previousLabel}
          </button>
          {getPages().map(p =>
            typeof p === 'string' ? (
              <span key={p} className="px-1 text-xs text-gray-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`${pillBase} ${
                  p === page
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${pillBase} bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}
