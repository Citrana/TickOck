'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {parseConvexError} from '@/lib/errors';
import {matchesDateFilter, isDateFilterActive} from '@/lib/dateFilter';
import DataTable, {ColumnDef} from '@/components/ui/DataTable';
import ColumnsPicker from '@/components/ui/ColumnsPicker';
import FilterPanel from '@/components/ui/FilterPanel';

type Props = {eventId: Id<'events'>};

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'rejected';
type MethodFilter = 'all' | 'manual' | 'online' | 'cash';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-500',
};

type Payment = NonNullable<
  ReturnType<typeof useQuery<typeof api.payments.listByEvent>>
>[number];

const ALL_COL_KEYS = ['buyer', 'amount', 'method', 'status', 'reference', 'proof', 'actionedBy'] as const;

export default function PaymentsPanel({eventId}: Props) {
  const t = useTranslations('manage.payments');
  const tToolbar = useTranslations('ui.toolbar');
  const tUiPanel = useTranslations('ui.filterPanel');
  const tFP = useTranslations('manage.payments.filterPanel');
  const tDateFilter = useTranslations('ui.dateFilter');
  const tPagination = useTranslations('ui.pagination');

  const payments = useQuery(api.payments.listByEvent, {eventId});
  const confirmPayment = useMutation(api.payments.confirmPayment);
  const rejectPayment = useMutation(api.payments.rejectPayment);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([...ALL_COL_KEYS]);

  const [rejecting, setRejecting] = useState<Id<'payments'> | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<Id<'payments'> | null>(null);

  if (payments === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({length: 3}).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const activeFilterCount =
    (methodFilter !== 'all' ? 1 : 0) + (isDateFilterActive(dateFrom, dateTo) ? 1 : 0);

  const filtered = (() => {
    let result = filter === 'all' ? payments : payments.filter(p => p.status === filter);
    if (methodFilter !== 'all') {
      result = result.filter(p => p.method === methodFilter);
    }
    if (isDateFilterActive(dateFrom, dateTo)) {
      result = result.filter(p => matchesDateFilter(p._creationTime, dateFrom, dateTo));
    }
    return result;
  })();

  function clearFilters() {
    setMethodFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  const FILTERS: {key: FilterStatus; label: string}[] = [
    {key: 'all', label: t('filterAll')},
    {key: 'pending', label: t('filterPending')},
    {key: 'confirmed', label: t('filterConfirmed')},
    {key: 'rejected', label: t('filterRejected')},
  ];

  async function handleConfirm(paymentId: Id<'payments'>) {
    setProcessing(paymentId);
    try {
      await confirmPayment({paymentId});
      toast.success(t('confirmSuccess'));
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('error')));
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(paymentId: Id<'payments'>) {
    setProcessing(paymentId);
    try {
      await rejectPayment({paymentId, reason: rejectReason || undefined});
      setRejecting(null);
      setRejectReason('');
      toast.success(t('rejectSuccess'));
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('error')));
    } finally {
      setProcessing(null);
    }
  }

  const colOptions = ALL_COL_KEYS.map(key => ({key, label: t(key as Parameters<typeof t>[0])}));

  const allColumns: ColumnDef<Payment>[] = [
    {
      key: 'buyer',
      header: t('buyer'),
      render: payment => (
        <div>
          <p className="font-medium text-gray-900">{payment.userName || payment.userEmail}</p>
          {payment.userName && <p className="text-xs text-gray-400">{payment.userEmail}</p>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('amount'),
      render: payment => (
        <span className="font-medium text-gray-700">
          {payment.amount} {payment.currency}
        </span>
      ),
    },
    {
      key: 'method',
      header: t('method'),
      render: payment => (
        <span className="text-gray-500">
          {payment.method === 'manual'
            ? t('methodManual')
            : payment.method === 'cash'
              ? t('methodCash')
              : t('methodOnline')}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      render: payment => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[payment.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {t(
            `status${payment.status.charAt(0).toUpperCase()}${payment.status.slice(1)}` as Parameters<typeof t>[0],
          )}
        </span>
      ),
    },
    {
      key: 'reference',
      header: t('reference'),
      render: payment =>
        payment.referenceNumber ? (
          <span className="font-mono text-xs text-gray-700">{payment.referenceNumber}</span>
        ) : (
          <span className="text-xs text-gray-400">{t('noReference')}</span>
        ),
    },
    {
      key: 'proof',
      header: t('proof'),
      render: payment =>
        payment.evidenceUrl ? (
          <a
            href={payment.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {t('viewProof')}
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: 'actionedBy',
      header: t('actionedBy'),
      render: payment =>
        payment.actionedByName ? (
          <div>
            <p className="text-sm text-gray-700">{payment.actionedByName}</p>
            {payment.actionedAt && (
              <p className="text-xs text-gray-400">
                {new Date(payment.actionedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">{t('actionedByNone')}</span>
        ),
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
                {payments.filter(p => p.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={10}
        getRowKey={payment => payment._id}
        emptyMessage={filter === 'all' ? t('empty') : t('emptyFiltered')}
        renderActions={payment => {
          const isProcessing = processing === payment._id;
          const isRejectingThis = rejecting === payment._id;

          if (isRejectingThis) {
            return (
              <div className="flex min-w-[220px] flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t('rejectReasonPlaceholder')}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                />
                <button
                  onClick={() => handleReject(payment._id)}
                  disabled={isProcessing}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isProcessing ? t('processing') : t('rejectTitle')}
                </button>
                <button
                  onClick={() => {
                    setRejecting(null);
                    setRejectReason('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {t('cancel')}
                </button>
              </div>
            );
          }

          if (payment.status === 'pending') {
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleConfirm(payment._id)}
                  disabled={isProcessing}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isProcessing ? t('processing') : t('confirm')}
                </button>
                <button
                  onClick={() => setRejecting(payment._id)}
                  disabled={isProcessing}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('reject')}
                </button>
              </div>
            );
          }

          return null;
        }}
        searchPlaceholder={tFP('searchPlaceholder')}
        searchFilter={(payment, q) =>
          (payment.userName ?? '').toLowerCase().includes(q) ||
          (payment.userEmail ?? '').toLowerCase().includes(q)
        }
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
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {tFP('methodLabel')}
          </label>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value as MethodFilter)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="all">{tFP('methodAll')}</option>
            <option value="manual">{t('methodManual')}</option>
            <option value="online">{t('methodOnline')}</option>
            <option value="cash">{t('methodCash')}</option>
          </select>
        </div>
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
