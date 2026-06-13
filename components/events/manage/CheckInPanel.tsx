'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {parseConvexError} from '@/lib/errors';

type Props = {eventId: Id<'events'>};

export default function CheckInPanel({eventId}: Props) {
  const t = useTranslations('manage.checkin');
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [checking, setChecking] = useState(false);

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
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">{t('recentTitle')}</h2>
        {!recentCheckIns || recentCheckIns.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">{t('noRecent')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {recentCheckIns.map(entry => (
              <li key={entry._id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{entry.buyerName}</p>
                  <p className="text-xs text-gray-500">
                    {entry.tierName}
                    {entry.ticketNumber && (
                      <span className="ml-2 font-mono font-semibold">{entry.ticketNumber}</span>
                    )}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(entry.scannedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
