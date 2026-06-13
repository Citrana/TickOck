'use client';

import {useState} from 'react';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';

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

export default function AttendeesPanel({eventId}: Props) {
  const t = useTranslations('manage.attendees');
  const tickets = useQuery(api.tickets.listByEvent, {eventId});
  const [filter, setFilter] = useState<FilterStatus>('all');

  if (tickets === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  const filtered =
    filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

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

  return (
    <div className="space-y-5">
      {/* Filter pills */}
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
                {tickets.filter(t => t.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {filter === 'all' ? t('empty') : t('emptyFiltered')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">{t('name')}</th>
                <th className="px-4 py-3 text-left">{t('tier')}</th>
                <th className="px-4 py-3 text-left">{t('status')}</th>
                <th className="px-4 py-3 text-right">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(ticket => (
                <tr key={ticket._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{ticket.userName}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ticket.tierName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ticket.status as TicketStatus] ?? 'bg-gray-100 text-gray-500'}`}
                    >
                      {STATUS_LABEL[ticket.status as TicketStatus] ?? ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
