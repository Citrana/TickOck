'use client';

import {useState} from 'react';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {matchesDateFilter, isDateFilterActive} from '@/lib/dateFilter';
import DataTable, {ColumnDef} from '@/components/ui/DataTable';
import ColumnsPicker from '@/components/ui/ColumnsPicker';
import FilterPanel from '@/components/ui/FilterPanel';

type Props = {eventId: Id<'events'>};

type TicketStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'used' | 'expired';
type FilterStatus = 'all' | TicketStatus;

const STATUS_BADGE: Record<TicketStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
  used: 'bg-blue-100 text-blue-800',
  expired: 'bg-red-100 text-red-700',
};

type Ticket = NonNullable<ReturnType<typeof useQuery<typeof api.tickets.listByEvent>>>[number];

const ALL_COL_KEYS = ['name', 'tier', 'status', 'date'] as const;

export default function AttendeesPanel({eventId}: Props) {
  const t = useTranslations('manage.attendees');
  const tToolbar = useTranslations('ui.toolbar');
  const tUiPanel = useTranslations('ui.filterPanel');
  const tFP = useTranslations('manage.attendees.filterPanel');
  const tDateFilter = useTranslations('ui.dateFilter');
  const tPagination = useTranslations('ui.pagination');

  const tickets = useQuery(api.tickets.listByEvent, {eventId});

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([...ALL_COL_KEYS]);

  if (tickets === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const tierOptions = Array.from(new Set(tickets.map(tk => tk.tierName))).sort();
  const activeFilterCount =
    (tierFilter !== 'all' ? 1 : 0) + (isDateFilterActive(dateFrom, dateTo) ? 1 : 0);

  const filtered = (() => {
    let result = filter === 'all' ? tickets : tickets.filter(tk => tk.status === filter);
    if (tierFilter !== 'all') {
      result = result.filter(tk => tk.tierName === tierFilter);
    }
    if (isDateFilterActive(dateFrom, dateTo)) {
      result = result.filter(tk => matchesDateFilter(tk.createdAt, dateFrom, dateTo));
    }
    return result;
  })();

  function clearFilters() {
    setTierFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  const FILTERS: {key: FilterStatus; label: string}[] = [
    {key: 'all', label: t('filterAll')},
    {key: 'confirmed', label: t('filterConfirmed')},
    {key: 'pending_payment', label: t('filterPending')},
    {key: 'used', label: t('filterUsed')},
    {key: 'cancelled', label: t('filterCancelled')},
  ];

  const STATUS_LABEL: Record<TicketStatus, string> = {
    pending_payment: t('statusPendingPayment'),
    confirmed: t('statusConfirmed'),
    cancelled: t('statusCancelled'),
    used: t('statusUsed'),
    expired: t('statusExpired'),
  };

  const colOptions = [
    {key: 'name', label: t('name')},
    {key: 'tier', label: t('tier')},
    {key: 'status', label: t('status')},
    {key: 'date', label: t('date')},
  ];

  const allColumns: ColumnDef<Ticket>[] = [
    {
      key: 'name',
      header: t('name'),
      render: ticket => (
        <p className="font-medium text-gray-900">{ticket.userName}</p>
      ),
    },
    {
      key: 'tier',
      header: t('tier'),
      render: ticket => <span className="text-gray-600">{ticket.tierName}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: ticket => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ticket.status as TicketStatus] ?? 'bg-gray-100 text-gray-500'}`}
        >
          {STATUS_LABEL[ticket.status as TicketStatus] ?? ticket.status}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('date'),
      headerClassName: 'text-right',
      cellClassName: 'text-right text-xs text-gray-400',
      render: ticket =>
        new Date(ticket.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
    },
  ];

  const columns = allColumns.filter(c => visibleCols.includes(c.key));

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-500">
          {tToolbar('results', {count: filtered.length})}
        </span>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
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

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {tickets.filter(tk => tk.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={10}
        getRowKey={ticket => ticket._id}
        emptyMessage={filter === 'all' ? t('empty') : t('emptyFiltered')}
        searchPlaceholder={tFP('searchPlaceholder')}
        searchFilter={(ticket, q) => (ticket.userName ?? '').toLowerCase().includes(q)}
        previousLabel={tPagination('previous')}
        nextLabel={tPagination('next')}
        formatResults={(from, to, total) => tPagination('results', {from, to, total})}
      />

      <FilterPanel
        open={filterOpen}
        title={tFP('title')}
        closeLabel={tUiPanel('close')}
        clearLabel={tUiPanel('clearAll')}
        onClose={() => setFilterOpen(false)}
        onClear={clearFilters}
      >
        {tierOptions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {tFP('tierLabel')}
            </label>
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="all">{tFP('allTiers')}</option>
              {tierOptions.map(tier => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            {tDateFilter('label')}
          </label>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{tDateFilter('from')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{tDateFilter('to')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>
      </FilterPanel>
    </div>
  );
}
