'use client';

import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';

type Props = {eventId: Id<'events'>};

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'amber' | 'blue' | 'gray';
}) {
  const bg =
    accent === 'green'
      ? 'bg-green-50 border-green-200'
      : accent === 'amber'
        ? 'bg-amber-50 border-amber-200'
        : accent === 'blue'
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white border-gray-200';
  const text =
    accent === 'green'
      ? 'text-green-900'
      : accent === 'amber'
        ? 'text-amber-900'
        : accent === 'blue'
          ? 'text-blue-900'
          : 'text-gray-900';

  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${text}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function SalesOverview({eventId}: Props) {
  const t = useTranslations('manage.overview');
  const stats = useQuery(api.events.getStats, {eventId});

  if (stats === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({length: 4}).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const sold = (stats.ticketCounts.confirmed ?? 0) + (stats.ticketCounts.used ?? 0);
  const available = stats.tiers.reduce((s, t) => s + t.available, 0);

  const fmt = (n: number) =>
    stats.currency ? `${n} ${stats.currency}` : String(n);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('confirmedRevenue')}
          value={fmt(stats.totalRevenue)}
          accent="green"
        />
        <StatCard
          label={t('pendingRevenue')}
          value={fmt(stats.pendingRevenue)}
          accent="amber"
        />
        <StatCard
          label={t('ticketsSold')}
          value={String(sold)}
          accent="blue"
        />
        <StatCard
          label={t('ticketsAvailable')}
          value={String(available)}
          accent="gray"
        />
      </div>

      {/* Tier breakdown */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('tierBreakdown')}</h3>
        {stats.tiers.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noTiers')}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">{t('tierName')}</th>
                  <th className="px-4 py-3 text-right">{t('tierPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('tierSold')}</th>
                  <th className="px-4 py-3 text-right">{t('tierAvailable')}</th>
                  <th className="px-4 py-3 text-right">{t('tierRevenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.tiers.map(tier => (
                  <tr key={tier._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{tier.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {tier.price === 0
                        ? t('free')
                        : `${tier.price} ${tier.currency}`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {tier.quantitySold}
                      <span className="ml-1 text-gray-400">/ {tier.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{tier.available}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {tier.price === 0
                        ? '—'
                        : `${tier.price * tier.quantitySold} ${tier.currency}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
