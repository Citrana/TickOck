import {Id} from '@/convex/_generated/dataModel';

export type FormTier = {
  tempId: string;
  existingId?: Id<'ticketTiers'>;
  name: string;
  price: string;
  currency: string;
  quantity: string;
  description: string;
  priceLocked: boolean;
  // Only used when the event has a venue layout — shown on the seat-map canvas.
  color?: string;
};

export type FormSpeaker = {
  tempId: string;
  existingId?: Id<'eventSpeakers'>;
  name: string;
  speakerTitle: string;
  bio: string;
  photoFile: File | null;
  photoPreviewUrl: string | null;
  photoStorageId: Id<'_storage'> | null;
};

export type EventFormData = {
  // Step 1 — Basic Info
  title: string;
  description: string;
  category: string;
  // Step 2 — Venue & Schedule
  venueName: string;
  venueAddress: string;
  venueCity: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM (optional)
  timezone: string;
  // Step 3 — Settings
  coverImageFile: File | null;
  coverImagePreviewUrl: string | null;
  coverImageStorageId: Id<'_storage'> | null;
  visibility: 'public' | 'private' | 'unlisted';
  paymentMode: 'online' | 'manual';
  cancellationAllowed: boolean;
  cancellationCutoffHours: string;
  // Step 4 — Speakers
  speakers: FormSpeaker[];
  // Step 5 — Ticket Tiers
  tiers: FormTier[];
  // Step 5 — Venue layout add-on (paid)
  seatMapEnabled: boolean;
  venueLayoutTemplateId: Id<'venueLayoutTemplates'> | null;
  // Step 6 — Review & Pay
  paymentScreenshotFile: File | null;
  paymentScreenshotStorageId: Id<'_storage'> | null;
};

export const EMPTY_FORM: EventFormData = {
  title: '',
  description: '',
  category: '',
  venueName: '',
  venueAddress: '',
  venueCity: '',
  date: '',
  startTime: '',
  endTime: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  coverImageFile: null,
  coverImagePreviewUrl: null,
  coverImageStorageId: null,
  visibility: 'public',
  paymentMode: 'manual',
  cancellationAllowed: false,
  cancellationCutoffHours: '24',
  speakers: [],
  tiers: [],
  seatMapEnabled: false,
  venueLayoutTemplateId: null,
  paymentScreenshotFile: null,
  paymentScreenshotStorageId: null,
};

export const EVENT_CATEGORIES = [
  'music',
  'sports',
  'technology',
  'arts',
  'food',
  'business',
  'education',
  'comedy',
  'workshop',
  'networking',
  'festival',
  'conference',
  'other',
] as const;

export const CURRENCIES = ['USD', 'EUR', 'CAD', 'GBP', 'XOF', 'XAF', 'MAD'] as const;

export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Montreal',
  'Europe/London',
  'Europe/Paris',
  'Europe/Brussels',
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Douala',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Casablanca',
] as const;
