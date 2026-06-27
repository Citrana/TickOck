'use client';

import {useQuery} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import DataTable, {ColumnDef} from '@/components/ui/DataTable';
import ColumnsPicker from '@/components/ui/ColumnsPicker';
import FilterPanel from '@/components/ui/FilterPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogRow = NonNullable<
  ReturnType<typeof useQuery<typeof api.adminReports.listAuditLogs>>
>[number];

// ---------------------------------------------------------------------------
// Column keys
// ---------------------------------------------------------------------------

const ALL_COL_KEYS = ['actor', 'role', 'action', 'targetType', 'targetId', 'date'] as const;
type ColKey = (typeof ALL_COL_KEYS)[number];

const DEFAULT_VISIBLE: ColKey[] = ['actor', 'role', 'action', 'targetType', 'date'];

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type Filters = {
  actor: string;
  action: string;
  targetType: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = {
  actor: '',
  action: '',
  targetType: '',
  dateFrom: '',
  dateTo: '',
};

function countActiveFilters(f: Filters): number {
  return [f.actor, f.action, f.targetType, f.dateFrom, f.dateTo].filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Cell sub-components
// ---------------------------------------------------------------------------

function ActionBadge({action}: {action: string}) {
  const [resource, verb] = action.includes(':') ? action.split(':') : [action, ''];
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{resource}</span>
      {verb && <span className="text-gray-400">:{verb}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuditLogReport() {
  const t = useTranslations('admin.auditLog');
  const tToolbar = useTranslations('ui.toolbar');
  const tUiPanel = useTranslations('ui.filterPanel');
  const tPagination = useTranslations('ui.pagination');

  const logs = useQuery(api.adminReports.listAuditLogs);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([...DEFAULT_VISIBLE]);

  const activeFilterCount = countActiveFilters(filters);

  const targetTypeOptions = Array.from(
    new Set((logs ?? []).map(l => l.targetType)),
  ).sort();

  const filtered = (logs ?? []).filter(row => {
    if (filters.actor) {
      const q = filters.actor.toLowerCase();
      if (
        !(row.actorName ?? '').toLowerCase().includes(q) &&
        !(row.actorEmail ?? '').toLowerCase().includes(q)
      )
        return false;
    }
    if (filters.action && !row.action.toLowerCase().includes(filters.action.toLowerCase()))
      return false;
    if (filters.targetType && row.targetType !== filters.targetType) return false;
    if (filters.dateFrom && row.createdAt < new Date(filters.dateFrom).getTime()) return false;
    if (filters.dateTo && row.createdAt > new Date(filters.dateTo).getTime() + 86_400_000)
      return false;
    return true;
  });

  const allColumns: ColumnDef<LogRow>[] = [
    {
      key: 'actor',
      header: t('cols.actor'),
      render: row => (
        <div>
          <p className="font-medium text-gray-900">
            {row.actorName ?? row.actorEmail ?? (
              <span className="font-mono text-xs text-gray-400">
                {String(row.actorId).slice(0, 8)}…
              </span>
            )}
          </p>
          {row.actorName && row.actorEmail && (
            <p className="text-xs text-gray-400">{row.actorEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: 'role',
      header: t('cols.role'),
      render: row =>
        row.actorRole ? (
          <span className="capitalize text-gray-600">{row.actorRole.replace('_', ' ')}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'action',
      header: t('cols.action'),
      render: row => <ActionBadge action={row.action} />,
    },
    {
      key: 'targetType',
      header: t('cols.targetType'),
      render: row => (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {row.targetType}
        </span>
      ),
    },
    {
      key: 'targetId',
      header: t('cols.targetId'),
      render: row => (
        <span className="font-mono text-xs text-gray-500">
          {row.targetId.length > 16 ? `${row.targetId.slice(0, 16)}…` : row.targetId}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('cols.date'),
      render: row => (
        <span className="whitespace-nowrap text-xs text-gray-500">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const columns = allColumns.filter(c => visibleCols.includes(c.key));

  const colOptions = ALL_COL_KEYS.map(key => ({key, label: t(`cols.${key}` as Parameters<typeof t>[0])}));

  if (logs === undefined) {
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
          {tToolbar('results', {count: filtered.length})}
        </span>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900"
            >
              {tToolbar('clearFilters')}
            </button>
          )}
          <ColumnsPicker
            all={colOptions}
            visible={visibleCols}
            onChange={setVisibleCols}
            buttonLabel={tToolbar('columns')}
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
            {tToolbar('filters')}
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-900">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        pageSize={20}
        getRowKey={row => row._id}
        emptyMessage={t('empty')}
        previousLabel={tPagination('previous')}
        nextLabel={tPagination('next')}
        formatResults={(from, to, total) => tPagination('results', {from, to, total})}
      />

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        title={t('filterPanel.title')}
        closeLabel={tUiPanel('close')}
        clearLabel={tUiPanel('clearAll')}
        onClose={() => setFilterOpen(false)}
        onClear={() => setFilters(EMPTY_FILTERS)}
      >
        {/* Actor */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.actor')}
          </label>
          <input
            type="text"
            value={filters.actor}
            onChange={e => setFilters({...filters, actor: e.target.value})}
            placeholder={t('filterPanel.actorPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Action */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.action')}
          </label>
          <input
            type="text"
            value={filters.action}
            onChange={e => setFilters({...filters, action: e.target.value})}
            placeholder={t('filterPanel.actionPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Target type */}
        {targetTypeOptions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('filterPanel.targetType')}
            </label>
            <select
              value={filters.targetType}
              onChange={e => setFilters({...filters, targetType: e.target.value})}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">{t('filterPanel.all')}</option>
              {targetTypeOptions.map(tt => (
                <option key={tt} value={tt}>
                  {tt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date from */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.dateFrom')}
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters({...filters, dateFrom: e.target.value})}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('filterPanel.dateTo')}
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters({...filters, dateTo: e.target.value})}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      </FilterPanel>
    </div>
  );
}
