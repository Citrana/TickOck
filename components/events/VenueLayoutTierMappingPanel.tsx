'use client';

import {useTranslations} from 'next-intl';
import {useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {Doc, Id} from '@/convex/_generated/dataModel';
import Select from '@/components/ui/Select';
import {summarizeVenueLayoutTiers, VenueLayoutTemplateWithLayout} from '@/lib/venueLayoutTierSummary';

type Props = {
  eventId: Id<'events'>;
  template: VenueLayoutTemplateWithLayout;
  ticketTiers: Doc<'ticketTiers'>[];
};

export default function VenueLayoutTierMappingPanel({eventId, template, ticketTiers}: Props) {
  const t = useTranslations('eventCreate.tickets.venueLayout.mapping');
  const mapTier = useMutation(api.venueLayout.mapVenueLayoutTierToTicketTier);

  const categories = summarizeVenueLayoutTiers(template, ticketTiers);
  const claimedTierIds = new Set(
    categories.map(c => c.ticketTierId).filter((id): id is string => !!id),
  );

  return (
    <div className="space-y-2 rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-700">{t('heading')}</p>
      <p className="text-xs text-gray-500">{t('prompt')}</p>

      <div className="space-y-2">
        {categories.map(category => {
          const mismatched =
            category.ticketTierId &&
            (() => {
              const linked = ticketTiers.find(t => t._id === category.ticketTierId);
              return linked ? linked.quantity < category.quantity : false;
            })();

          return (
            <div key={category.tierId} className="rounded-md border border-gray-200 bg-white p-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: category.color}} />
                <span className="font-medium text-gray-800">{category.name}</span>
                <span className="text-gray-400">
                  · {t('paintedCount', {count: category.quantity})}
                </span>
              </div>
              <div className="mt-1.5">
                <Select
                  value={category.ticketTierId ?? ''}
                  onChange={e =>
                    mapTier({
                      eventId,
                      venueLayoutTierId: category.tierId as Id<'venueLayoutTiers'>,
                      ticketTierId: e.target.value
                        ? (e.target.value as Id<'ticketTiers'>)
                        : undefined,
                    })
                  }
                  className="text-xs"
                >
                  <option value="">{t('unmapped')}</option>
                  {ticketTiers.map(tier => (
                    <option
                      key={tier._id}
                      value={tier._id}
                      disabled={claimedTierIds.has(tier._id) && tier._id !== category.ticketTierId}
                    >
                      {tier.name} — {tier.price} {tier.currency}
                    </option>
                  ))}
                </Select>
              </div>
              {mismatched && (
                <p className="mt-1 text-xs text-amber-600">{t('quantityMismatchWarning')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
