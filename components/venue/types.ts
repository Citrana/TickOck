import {Doc} from '@/convex/_generated/dataModel';

export type VenueSection = Doc<'venueLayoutSections'>;
export type VenueTier = Doc<'venueLayoutTiers'>;
export type VenueSeat = Doc<'venueLayoutSeats'>;
export type VenueElement = Doc<'venueLayoutElements'>;

export type VenueElementKind = VenueElement['kind'];
export type DoorType = NonNullable<VenueElement['doorType']>;
export type AmenityType = NonNullable<VenueElement['amenityType']>;
export type StageShapeKind = NonNullable<VenueElement['shape']>;
export type VenuePoint = {x: number; y: number};

export type SeatStatus = 'available' | 'selected' | 'unavailable';

export type CanvasMode = 'edit' | 'select';

export const SEAT_RADIUS = 12;
