import {Doc} from '@/convex/_generated/dataModel';

// Matches the shape returned by api.venueLayout.getTemplate /
// api.venueLayout.getSnapshotForEvent.
export type VenueLayoutTemplateWithLayout = Doc<'venueLayoutTemplates'> & {
  sections: Doc<'venueLayoutSections'>[];
  tiers: Doc<'venueLayoutTiers'>[];
  seats: Doc<'venueLayoutSeats'>[];
};

export type DerivedTierSummary = {
  tierId: string;
  name: string;
  color: string;
  quantity: number;
  // null until this category is mapped to one of the event's real,
  // priced ticketTiers — a layout's own tiers are just named color
  // categories, price always comes from the mapping.
  price: number | null;
  currency: string | null;
  ticketTierId: string | null;
};

/**
 * Aggregates a venue layout's seats/GA capacity per category, and — when
 * the event's ticketTiers are supplied — resolves each category's mapped
 * price via the ticketTiers.venueLayoutTierId bridge. Used to preview a
 * layout's categories (and, once mapped, their prices) before/after attach.
 */
export function summarizeVenueLayoutTiers(
  template: VenueLayoutTemplateWithLayout,
  ticketTiersForEvent: Doc<'ticketTiers'>[] = [],
): DerivedTierSummary[] {
  const quantityByTier = new Map<string, number>();
  for (const seat of template.seats) {
    if (!seat.tierId) continue;
    quantityByTier.set(seat.tierId, (quantityByTier.get(seat.tierId) ?? 0) + 1);
  }
  for (const section of template.sections) {
    if (section.kind === 'ga' && section.tierId) {
      quantityByTier.set(
        section.tierId,
        (quantityByTier.get(section.tierId) ?? 0) + (section.gaCapacity ?? 0),
      );
    }
  }

  const linkedByCategory = new Map(
    ticketTiersForEvent
      .filter(t => t.venueLayoutTierId)
      .map(t => [t.venueLayoutTierId!, t]),
  );

  return template.tiers.map(tier => {
    const linked = linkedByCategory.get(tier._id);
    return {
      tierId: tier._id,
      name: tier.name,
      color: tier.color,
      quantity: quantityByTier.get(tier._id) ?? 0,
      price: linked?.price ?? null,
      currency: linked?.currency ?? null,
      ticketTierId: linked?._id ?? null,
    };
  });
}
