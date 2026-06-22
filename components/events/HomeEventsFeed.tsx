'use client';

import {useQuery} from 'convex/react';
import {api} from '@/convex/_generated/api';
import EventCard from './EventCard';

export default function HomeEventsFeed() {
  const events = useQuery(api.events.listLive, {});

  if (events === undefined) {
    return (
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="animate-pulse">
            <div className="aspect-video w-full rounded-xl bg-gray-200" />
            <div className="mt-4 h-5 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/2 rounded bg-gray-100" />
            <div className="mt-1 h-4 w-2/5 rounded bg-gray-100" />
            <div className="mt-3 h-4 w-1/4 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  const featured = events.slice(0, 3);

  if (featured.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {featured.map(event => (
        <EventCard key={event._id} event={event} />
      ))}
    </div>
  );
}
