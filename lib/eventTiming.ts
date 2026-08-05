import {type Doc} from '@/convex/_generated/dataModel';

export const EVENT_ENDED_ERROR = 'This event has ended';
export const EVENT_ENDED_EDIT_ERROR = 'This event has ended and can no longer be edited';

/**
 * Converts a wall-clock local date + time to the equivalent UTC timestamp (ms).
 * `dateMs` must be a UTC-midnight timestamp for the calendar day (as produced by
 * `new Date("YYYY-MM-DD").getTime()`); `time` is "HH:mm" wall-clock time meant to be
 * read in `timeZone` (an IANA zone name).
 */
export function zonedDateTimeToUtcMs(dateMs: number, time: string, timeZone: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(dateMs);
  const guessUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hours, minutes);
  return guessUtc - getTimezoneOffsetMs(timeZone, guessUtc);
}

function getTimezoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

export function getEventEndMs(event: Pick<Doc<'events'>, 'date' | 'endTime' | 'timezone'>): number {
  if (!event.endTime) return event.date + 24 * 3_600_000;
  return zonedDateTimeToUtcMs(event.date, event.endTime, event.timezone);
}

export function getEventStartMs(event: Pick<Doc<'events'>, 'date' | 'startTime' | 'timezone'>): number {
  return zonedDateTimeToUtcMs(event.date, event.startTime, event.timezone);
}

export function hasEventEnded(event: Pick<Doc<'events'>, 'date' | 'endTime' | 'timezone'>): boolean {
  return Date.now() > getEventEndMs(event);
}
