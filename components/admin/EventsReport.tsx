'use client';

import {useQuery} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {useTranslations} from 'next-intl';
import {useState, useRef, useEffect} from 'react';
import EventStatusBadge from '@/components/events/EventStatusBadge';

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

type ColumnKey =
  | 'title'
  | 'status'
  | 'date'
  | 'startTime'
  | 'city'
  | 'owner'
  | 'category'
  | 'venue'
  | 'visibility'
  | 'paymentMode'
  | 'tierCount'
  | 'createdAt';

const ALL_COLUMNS: ColumnKey[] = [
  'title',
  'status',
  'date',
  'startTime',
  'city',
  'owner',
  'category',
  'venue',
  'visibility',
  'paymentMode',
  'tierCount',
  'createdAt',
];

const DEFAULT_VISIBLE: ColumnKey[] = ['title', 'status', 'date', 'startTime', 'city'];

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type Filters = {
  name: string;
  statuses: string[];
  dateFrom: string;
  dateTo: string;
  category: string;
  city: string;
  visibility: string;
  paymentMode: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  statuses: [],
  dateFrom: '',
  dateTo: '',
  category: '',
  city: '',
  visibility: '',
  paymentMode: '',
};

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.name) n++;
  if (f.statuses.length) n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  if (f.category) n++;
  if (f.city) n++;
  if (f.visibility) n++;
  if (f.paymentMode) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type EventRow = NonNullable<ReturnType<typeof useQuery<typeof api.adminReports.listAllEvents>>>[number];

function FilterPanel({
  open,
  filters,
  onChange,
  onClose,
}: {
  open: boolean;
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
}) {
  const t = useTranslations('admin.reports');
  const STATUSES = ['draft', 'pending_approval', 'live', 'rejected'] as const;

  function toggleStatus(s: string) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    onChange({...filters, statuses: next});
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={[
          'fixed right-0 top-0 z-40 flex h-full w-80 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('filterPanel.title')}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label={t('filterPanel.close')}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.name')}
            </label>
            <input
              type="text"
              value={filters.name}
              onChange={e => onChange({...filters, name: e.target.value})}
              placeholder={t('filterPanel.namePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.status')}
            </label>
            <div className="space-y-2">
              {STATUSES.map(s => (
                <label key={s} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(s)}
                    onChange={() => toggleStatus(s)}
                    className="h-4 w-4 rounded border-gray-300 accent-gray-900"
                  />
                  <span className="text-sm text-gray-700">{t(`status.${s}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.dateFrom')}
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => onChange({...filters, dateFrom: e.target.value})}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.dateTo')}
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => onChange({...filters, dateTo: e.target.value})}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.category')}
            </label>
            <input
              type="text"
              value={filters.category}
              onChange={e => onChange({...filters, category: e.target.value})}
              placeholder={t('filterPanel.categoryPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* City */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.city')}
            </label>
            <input
              type="text"
              value={filters.city}
              onChange={e => onChange({...filters, city: e.target.value})}
              placeholder={t('filterPanel.cityPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.visibility')}
            </label>
            <select
              value={filters.visibility}
              onChange={e => onChange({...filters, visibility: e.target.value})}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">{t('filterPanel.all')}</option>
              <option value="public">{t('visibility.public')}</option>
              <option value="private">{t('visibility.private')}</option>
              <option value="unlisted">{t('visibility.unlisted')}</option>
            </select>
          </div>

          {/* Payment mode */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.paymentMode')}
            </label>
            <select
              value={filters.paymentMode}
              onChange={e => onChange({...filters, paymentMode: e.target.value})}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">{t('filterPanel.all')}</option>
              <option value="online">{t('paymentMode.online')}</option>
              <option value="manual">{t('paymentMode.manual')}</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-4">
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t('filterPanel.clearAll')}
          </button>
        </div>
      </div>
    </>
  );
}

function ColumnsPicker({
  visible,
  onChange,
}: {
  visible: ColumnKey[];
  onChange: (cols: ColumnKey[]) => void;
}) {
  const t = useTranslations('admin.reports');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(col: ColumnKey) {
    const next = visible.includes(col)
      ? visible.filter(c => c !== col)
      : [...visible, col];
    // always keep at least one column
    if (next.length === 0) return;
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
        </svg>
        {t('columnsButton')}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-48 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {ALL_COLUMNS.map(col => (
            <label
              key={col}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={visible.includes(col)}
                onChange={() => toggle(col)}
                className="h-4 w-4 rounded border-gray-300 accent-gray-900"
              />
              <span className="text-sm text-gray-700">{t(`cols.${col}`)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell renderers
// ---------------------------------------------------------------------------

function renderCell(col: ColumnKey, row: EventRow): React.ReactNode {
  switch (col) {
    case 'title':
      return <span className="font-medium text-gray-900">{row.title}</span>;
    case 'status':
      return <EventStatusBadge status={row.status} />;
    case 'date':
      return (
        <span className="whitespace-nowrap text-gray-600">
          {new Date(row.date).toLocaleDateString()}
        </span>
      );
    case 'startTime':
      return <span className="text-gray-600">{row.startTime}</span>;
    case 'city':
      return <span className="text-gray-600">{row.venue.city}</span>;
    case 'owner':
      return <span className="text-gray-600">{row.ownerName ?? '—'}</span>;
    case 'category':
      return <span className="text-gray-600">{row.category ?? '—'}</span>;
    case 'venue':
      return <span className="text-gray-600">{row.venue.name}</span>;
    case 'visibility':
      return (
        <span className="capitalize text-gray-600">
          {row.visibility}
        </span>
      );
    case 'paymentMode':
      return (
        <span className="capitalize text-gray-600">
          {row.paymentMode}
        </span>
      );
    case 'tierCount':
      return <span className="text-gray-600">{row.tierCount}</span>;
    case 'createdAt':
      return (
        <span className="whitespace-nowrap text-gray-600">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventsReport() {
  const t = useTranslations('admin.reports');
  const events = useQuery(api.adminReports.listAllEvents);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(DEFAULT_VISIBLE);

  const activeFilterCount = countActiveFilters(filters);

  const filtered = (events ?? []).filter(row => {
    if (
      filters.name &&
      !row.title.toLowerCase().includes(filters.name.toLowerCase())
    )
      return false;

    if (filters.statuses.length && !filters.statuses.includes(row.status))
      return false;

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      if (row.date < from) return false;
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_400_000; // inclusive
      if (row.date > to) return false;
    }

    if (
      filters.category &&
      !(row.category ?? '').toLowerCase().includes(filters.category.toLowerCase())
    )
      return false;

    if (
      filters.city &&
      !row.venue.city.toLowerCase().includes(filters.city.toLowerCase())
    )
      return false;

    if (filters.visibility && row.visibility !== filters.visibility) return false;

    if (filters.paymentMode && row.paymentMode !== filters.paymentMode) return false;

    return true;
  });

  if (events === undefined) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-500">
          {t('resultsCount', {count: filtered.length})}
        </span>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900"
            >
              {t('clearFilters')}
            </button>
          )}

          <ColumnsPicker visible={visibleCols} onChange={setVisibleCols} />

          <button
            onClick={() => setFilterOpen(true)}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              activeFilterCount > 0
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
            ].join(' ')}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            {t('filterButton')}
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-900">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-900">{t('empty')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {visibleCols.map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {t(`cols.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(row => (
                <tr key={row._id} className="hover:bg-gray-50">
                  {visibleCols.map(col => (
                    <td key={col} className="px-4 py-3">
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
