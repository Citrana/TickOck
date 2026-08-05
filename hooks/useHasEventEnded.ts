'use client';

import {useEffect, useState} from 'react';
import {hasEventEnded as computeHasEventEnded} from '@/lib/eventTiming';
import {type Doc} from '@/convex/_generated/dataModel';

type EventTiming = Pick<Doc<'events'>, 'date' | 'endTime' | 'timezone'>;

/**
 * Tracks whether an event has already ended, re-checking on an interval so
 * the UI reacts even if the event ends while the page stays open.
 */
export function useHasEventEnded(event: EventTiming | null | undefined): boolean {
  const [hasEnded, setHasEnded] = useState(() => (event ? computeHasEventEnded(event) : false));

  useEffect(() => {
    if (!event) return;
    const check = () => setHasEnded(computeHasEventEnded(event));
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [event]);

  return hasEnded;
}
