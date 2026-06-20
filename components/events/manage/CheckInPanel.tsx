'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {parseConvexError} from '@/lib/errors';
import DataTable, {ColumnDef} from '@/components/ui/DataTable';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';

type Props = {eventId: Id<'events'>};

type CheckInEntry = NonNullable<
  ReturnType<typeof useQuery<typeof api.tickets.recentCheckIns>>
>[number];

export default function CheckInPanel({eventId}: Props) {
  const t = useTranslations('manage.checkin');
  const tPagination = useTranslations('ui.pagination');
  const tToolbar = useTranslations('ui.toolbar');
  const tFilterPanel = useTranslations('ui.filterPanel');
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [checking, setChecking] = useState(false);
  const [filterChecker, setFilterChecker] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const preview = useQuery(
    api.tickets.findTicket,
    searchTerm ? {eventId, identifier: searchTerm} : 'skip',
  );
  const recentCheckIns = useQuery(api.tickets.recentCheckIns, {eventId});
  const checkInMutation = useMutation(api.tickets.checkIn);

  function handleLookup() {
    setSearchTerm(input.trim());
  }

  async function handleCheckIn() {
    if (!searchTerm) return;
    setChecking(true);
    try {
      const result = await checkInMutation({eventId, identifier: searchTerm});
      toast.success(t('success'), {description: `${result.buyerName} · ${result.tierName}`});
      setInput('');
      setSearchTerm('');
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('errorGeneric')));
    } finally {
      setChecking(false);
    }
  }

  const statusStyle: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    used: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-gray-100 text-gray-500',
    pending_payment: 'bg-amber-100 text-amber-800',
    expired: 'bg-red-100 text-red-700',
  };

  const allEntries = recentCheckIns ?? [];
  const uniqueCheckers = Array.from(new Set(allEntries.map(e => e.scannedByName))).sort();
  const filtered = allEntries.filter(
    e => filterChecker === 'all' || e.scannedByName === filterChecker,
  );
  const activeFilterCount = filterChecker !== 'all' ? 1 : 0;

  const recentColumns: ColumnDef<CheckInEntry>[] = [
    {
      key: 'attendee',
      header: t('recentColumns.attendee'),
      render: entry => (
        <div>
          <p className="font-medium text-gray-900">{entry.buyerName}</p>
          <p className="text-xs text-gray-500">
            {entry.tierName}
            {entry.ticketNumber && (
              <span className="ml-2 font-mono font-semibold">{entry.ticketNumber}</span>
            )}
          </p>
        </div>
      ),
    },
    {
      key: 'checkedBy',
      header: t('recentColumns.checkedBy'),
      cellClassName: 'text-xs text-gray-500',
      render: entry => entry.scannedByName,
    },
    {
      key: 'time',
      header: t('recentColumns.time'),
      headerClassName: 'text-right',
      render: entry => {
        const d = new Date(entry.scannedAt);
        return (
          <div className="text-right text-xs text-gray-400">
            <p>{d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</p>
            <p>{d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})}</p>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Search box */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('description')}</p>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => {
              setInput(e.target.value.toUpperCase());
              if (!e.target.value) setSearchTerm('');
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleLookup();
            }}
            placeholder={t('inputPlaceholder')}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono uppercase placeholder:normal-case placeholder:font-sans focus:border-gray-900 focus:outline-none"
            maxLength={200}
          />
          <button
            onClick={handleLookup}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            disabled={!input.trim()}
          >
            {t('lookupButton')}
          </button>
        </div>

        {/* Preview card */}
        {searchTerm && preview !== undefined && (
          <div className="mt-4">
            {preview === null ? (
              <p className="text-sm text-gray-500">{t('notFound')}</p>
            ) : (
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{preview.buyerName}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{preview.buyerEmail}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('tier')}: <span className="font-medium">{preview.tierName}</span>
                    </p>
                    {preview.ticketNumber && (
                      <p className="mt-0.5 font-mono text-sm font-bold text-gray-900">
                        {preview.ticketNumber}
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[preview.status] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {t(`status.${preview.status}` as Parameters<typeof t>[0])}
                  </span>
                </div>

                {preview.status === 'confirmed' && (
                  <button
                    onClick={handleCheckIn}
                    disabled={checking}
                    className="mt-4 w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {checking ? t('checkingIn') : t('checkInButton')}
                  </button>
                )}

                {preview.status === 'used' && preview.scannedAt && (
                  <p className="mt-3 text-xs text-blue-600">
                    {t('alreadyUsedAt', {
                      time: new Date(preview.scannedAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent check-ins */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">{t('recentTitle')}</h2>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilterChecker('all')}
                className="text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                {tToolbar('clearFilters')}
              </button>
            )}
            <button
              onClick={() => setFilterOpen(true)}
              className={[
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                activeFilterCount > 0
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z"
                  clipRule="evenodd"
                />
              </svg>
              {tToolbar('filters')}
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-gray-900 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500">{tToolbar('results', {count: filtered.length})}</p>

        <DataTable
          columns={recentColumns}
          data={filtered}
          pageSize={10}
          getRowKey={entry => entry._id}
          emptyMessage={t('noRecent')}
          searchPlaceholder={t('recentSearchPlaceholder')}
          searchFilter={(entry, q) =>
            entry.buyerName.toLowerCase().includes(q) ||
            (entry.ticketNumber ?? '').toLowerCase().includes(q)
          }
          previousLabel={tPagination('previous')}
          nextLabel={tPagination('next')}
          formatResults={(from, to, total) => tPagination('results', {from, to, total})}
        />
      </div>

      <FilterPanel
        open={filterOpen}
        title={t('filterPanel.title')}
        closeLabel={tFilterPanel('close')}
        clearLabel={tFilterPanel('clearAll')}
        onClose={() => setFilterOpen(false)}
        onClear={() => {
          setFilterChecker('all');
          setFilterOpen(false);
        }}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            {t('filterPanel.checkedByLabel')}
          </label>
          <Select value={filterChecker} onChange={e => setFilterChecker(e.target.value)}>
            <option value="all">{t('filterPanel.allCheckers')}</option>
            {uniqueCheckers.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      </FilterPanel>
    </div>
  );
}
