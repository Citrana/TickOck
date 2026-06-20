'use client';

import {useQuery, useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import FilterPanel from '@/components/ui/FilterPanel';
import ColumnsPicker from '@/components/ui/ColumnsPicker';

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

type ColumnKey = 'name' | 'email' | 'status' | 'role' | 'createdAt';

const ALL_COLUMNS: ColumnKey[] = ['name', 'email', 'status', 'role', 'createdAt'];
const DEFAULT_VISIBLE: ColumnKey[] = ['name', 'email', 'status', 'role', 'createdAt'];

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type Filters = {
  search: string;
  statuses: string[];
  role: string;
  registeredFrom: string;
  registeredTo: string;
};

const EMPTY_FILTERS: Filters = {
  search: '',
  statuses: [],
  role: '',
  registeredFrom: '',
  registeredTo: '',
};

const USER_STATUSES = [
  'active',
  'suspended',
  'pending_verification',
  'banned',
] as const;

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.search) n++;
  if (f.statuses.length) n++;
  if (f.role) n++;
  if (f.registeredFrom) n++;
  if (f.registeredTo) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRow = NonNullable<
  ReturnType<typeof useQuery<typeof api.adminReports.listAllUsers>>
>[number];

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<
  string,
  {classes: string; label: (t: (k: string) => string) => string}
> = {
  active: {
    classes: 'bg-green-100 text-green-700',
    label: t => t('status.active'),
  },
  suspended: {
    classes: 'bg-amber-100 text-amber-700',
    label: t => t('status.suspended'),
  },
  pending_verification: {
    classes: 'bg-gray-100 text-gray-600',
    label: t => t('status.pending_verification'),
  },
  banned: {
    classes: 'bg-red-100 text-red-700',
    label: t => t('status.banned'),
  },
};

function UserStatusBadge({status}: {status: string}) {
  const t = useTranslations('admin.usersReport');
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.classes}`}
    >
      {cfg.label(t)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Suspend / reactivate inline action
// ---------------------------------------------------------------------------

function SuspendAction({row}: {row: UserRow}) {
  const t = useTranslations('admin.usersReport');
  const setStatus = useMutation(api.adminReports.setUserStatus);

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (row.isCurrentUser || row.status === 'banned') return null;

  async function handleSuspend() {
    setBusy(true);
    try {
      await setStatus({userId: row._id, status: 'suspended', reason: reason || undefined});
      setConfirming(false);
      setReason('');
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    setBusy(true);
    try {
      await setStatus({userId: row._id, status: 'active'});
    } finally {
      setBusy(false);
    }
  }

  if (row.status === 'suspended') {
    return (
      <button
        disabled={busy}
        onClick={handleReactivate}
        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? t('actions.processing') : t('actions.reactivate')}
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('actions.suspendReasonPlaceholder')}
          className="w-48 rounded-lg border border-gray-300 px-2.5 py-1 text-xs placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <div className="flex gap-1.5">
          <button
            disabled={busy}
            onClick={handleSuspend}
            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? t('actions.processing') : t('actions.confirmSuspend')}
          </button>
          <button
            onClick={() => {
              setConfirming(false);
              setReason('');
            }}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t('actions.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
    >
      {t('actions.suspend')}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cell renderers
// ---------------------------------------------------------------------------

function renderCell(col: ColumnKey, row: UserRow): React.ReactNode {
  switch (col) {
    case 'name':
      return (
        <span className="font-medium text-gray-900">
          {row.name ?? <span className="italic text-gray-400">—</span>}
        </span>
      );
    case 'email':
      return <span className="text-gray-600">{row.email}</span>;
    case 'status':
      return <UserStatusBadge status={row.status} />;
    case 'role':
      return (
        <span className="text-gray-600">
          {row.roleName ? (
            <span className="capitalize">{row.roleName.replace('_', ' ')}</span>
          ) : (
            <span className="italic text-gray-400">—</span>
          )}
        </span>
      );
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

export default function UsersReport() {
  const t = useTranslations('admin.usersReport');
  const users = useQuery(api.adminReports.listAllUsers);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(DEFAULT_VISIBLE);

  const activeFilterCount = countActiveFilters(filters);

  // Collect unique role names for the role filter dropdown
  const roleOptions = Array.from(
    new Set((users ?? []).map(u => u.roleName).filter((r): r is string => r !== null)),
  ).sort();

  function toggleStatus(s: string) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    setFilters({...filters, statuses: next});
  }

  const filtered = (users ?? []).filter(row => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!row.email.toLowerCase().includes(q) && !(row.name ?? '').toLowerCase().includes(q))
        return false;
    }
    if (filters.statuses.length && !filters.statuses.includes(row.status)) return false;
    if (filters.role && row.roleName !== filters.role) return false;
    if (filters.registeredFrom) {
      if (row.createdAt < new Date(filters.registeredFrom).getTime()) return false;
    }
    if (filters.registeredTo) {
      if (row.createdAt > new Date(filters.registeredTo).getTime() + 86_400_000) return false;
    }
    return true;
  });

  if (users === undefined) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
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
          <ColumnsPicker
            all={ALL_COLUMNS.map(col => ({key: col, label: t(`cols.${col}` as Parameters<typeof t>[0])}))}
            visible={visibleCols}
            onChange={keys => setVisibleCols(keys as ColumnKey[])}
            buttonLabel={t('columnsButton')}
          />
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
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                clipRule="evenodd"
              />
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
                {/* Actions column is always shown */}
                <th className="px-4 py-3" />
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
                  <td className="px-4 py-3 text-right">
                    <SuspendAction row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        title={t('filterPanel.title')}
        closeLabel={t('filterPanel.close')}
        clearLabel={t('filterPanel.clearAll')}
        onClose={() => setFilterOpen(false)}
        onClear={() => setFilters(EMPTY_FILTERS)}
      >
        {/* Search */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.search')}
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilters({...filters, search: e.target.value})}
            placeholder={t('filterPanel.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Status */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.status')}
          </label>
          <div className="space-y-2">
            {USER_STATUSES.map(s => (
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

        {/* Role */}
        {roleOptions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.role')}
            </label>
            <select
              value={filters.role}
              onChange={e => setFilters({...filters, role: e.target.value})}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">{t('filterPanel.all')}</option>
              {roleOptions.map(r => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Registered from */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.registeredFrom')}
          </label>
          <input
            type="date"
            value={filters.registeredFrom}
            onChange={e => setFilters({...filters, registeredFrom: e.target.value})}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Registered to */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.registeredTo')}
          </label>
          <input
            type="date"
            value={filters.registeredTo}
            onChange={e => setFilters({...filters, registeredTo: e.target.value})}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      </FilterPanel>
    </div>
  );
}
