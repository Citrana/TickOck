import {Doc} from '@/convex/_generated/dataModel';

export type VenueSection = Doc<'venueLayoutSections'>;
export type VenueTier = Doc<'venueLayoutTiers'>;
export type VenueSeat = Doc<'venueLayoutSeats'>;

export type SeatStatus = 'available' | 'selected' | 'unavailable';

export type CanvasMode = 'edit' | 'select';

export const SEAT_RADIUS = 12;
