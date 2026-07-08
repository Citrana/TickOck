// Pure, client-side seat layout generators. No Convex calls here — callers
// take the returned drafts, let the organizer drag individual seats if they
// want, then persist via venueLayout.bulkInsertSeats.

// Convex mutations have per-call document-write limits — chunk bulk seat
// operations (both client-side batching and the server-side hard cap) around
// this single shared constant.
export const MAX_SEATS_PER_CALL = 300;

export type SeatDraft = {
  x: number;
  y: number;
  rowLabel?: string;
  seatLabel: string;
  tableLabel?: string;
  displayOrder: number;
};

function rowLetter(index: number): string {
  // 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, ...
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function generateGridRows(opts: {
  rows: number;
  seatsPerRow: number;
  startX: number;
  startY: number;
  seatGap: number;
  rowGap: number;
  startRowIndex?: number;
}): SeatDraft[] {
  const {rows, seatsPerRow, startX, startY, seatGap, rowGap, startRowIndex = 0} = opts;
  const seats: SeatDraft[] = [];
  let order = 0;
  for (let r = 0; r < rows; r++) {
    const label = rowLetter(startRowIndex + r);
    for (let s = 0; s < seatsPerRow; s++) {
      seats.push({
        x: startX + s * seatGap,
        y: startY + r * rowGap,
        rowLabel: label,
        seatLabel: `${label}${s + 1}`,
        displayOrder: order++,
      });
    }
  }
  return seats;
}

export function generateCurvedRows(opts: {
  rows: number;
  seatsPerRow: number;
  centerX: number;
  centerY: number;
  radiusStart: number;
  radiusStep: number;
  arcDegrees: number;
  startRowIndex?: number;
}): SeatDraft[] {
  const {
    rows,
    seatsPerRow,
    centerX,
    centerY,
    radiusStart,
    radiusStep,
    arcDegrees,
    startRowIndex = 0,
  } = opts;
  const seats: SeatDraft[] = [];
  let order = 0;
  const arcRad = (arcDegrees * Math.PI) / 180;
  for (let r = 0; r < rows; r++) {
    const label = rowLetter(startRowIndex + r);
    const radius = radiusStart + r * radiusStep;
    for (let s = 0; s < seatsPerRow; s++) {
      const t = seatsPerRow === 1 ? 0.5 : s / (seatsPerRow - 1);
      const angle = -arcRad / 2 + t * arcRad - Math.PI / 2;
      seats.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        rowLabel: label,
        seatLabel: `${label}${s + 1}`,
        displayOrder: order++,
      });
    }
  }
  return seats;
}

export function generateRoundTable(opts: {
  tableLabel: string;
  seatCount: number;
  centerX: number;
  centerY: number;
  radius: number;
}): SeatDraft[] {
  const {tableLabel, seatCount, centerX, centerY, radius} = opts;
  const seats: SeatDraft[] = [];
  for (let i = 0; i < seatCount; i++) {
    const angle = (2 * Math.PI * i) / seatCount - Math.PI / 2;
    seats.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      tableLabel,
      seatLabel: `${tableLabel} - Seat ${i + 1}`,
      displayOrder: i,
    });
  }
  return seats;
}
