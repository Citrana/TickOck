'use client';

import {useState} from 'react';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import EventCard from './EventCard';

const CATEGORIES = [
  'music', 'sports', 'technology', 'arts', 'food',
  'business', 'education', 'comedy', 'workshop',
  'networking', 'festival', 'conference', 'other',
] as const;

export default function EventsDiscovery() {
  const t = useTranslations('events');
  const tCategories = useTranslations('eventCreate.basicInfo');

  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');

  const events = useQuery(api.events.listLive, {
    category: category || undefined,
    city: city || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
  });

  const hasFilters = !!(category || city || dateFrom);

  function clearFilters() {
    setCategory('');
    setCity('');
    setDateFrom('');
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-gray-900 focus:outline-none"
        >
          <option value="">{t('allCategories')}</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {tCategories(`categories.${cat}` as Parameters<typeof tCategories>[0])}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder={t('filterCity')}
          value={city}
          onChange={e => setCity(e.target.value)}
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
        />

        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-gray-900 focus:outline-none"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t('clearFilters')}
          </button>
        )}
      </div>

      {/* Event grid */}
      {events === undefined ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({length: 6}).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">
          {hasFilters ? t('noEventsFiltered') : t('noEvents')}
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard key={event._id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
