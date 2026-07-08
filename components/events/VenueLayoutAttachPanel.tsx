'use client';

import {useTranslations, useLocale} from 'next-intl';
import {useQuery, useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {Link} from '@/lib/navigation';
import {EventFormData} from '@/types/eventForm';
import Select from '@/components/ui/Select';
import {calculatePlatformFee} from '@/lib/platformFee';
import {summarizeVenueLayoutTiers} from '@/lib/venueLayoutTierSummary';
import VenueLayoutTierMappingPanel from './VenueLayoutTierMappingPanel';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
  savedEventId?: Id<'events'>;
};

export default function VenueLayoutAttachPanel({data, onChange, savedEventId}: Props) {
  const t = useTranslations('eventCreate.tickets.venueLayout');
  const locale = useLocale();
  const templates = useQuery(api.venueLayout.listMineForAttach);
  const venueLayoutRules = useQuery(api.platformPricing.listActive, {category: 'venue_layout'});
  const chosenTemplate = useQuery(
    api.venueLayout.getTemplate,
    data.venueLayoutTemplateId ? {layoutId: data.venueLayoutTemplateId} : 'skip',
  );
  const savedEvent = useQuery(
    api.events.get,
    savedEventId ? {eventId: savedEventId} : 'skip',
  );
  const createTemplate = useMutation(api.venueLayout.createTemplate);

  function toggle(enabled: boolean) {
    onChange({
      seatMapEnabled: enabled,
      venueLayoutTemplateId: enabled ? data.venueLayoutTemplateId : null,
    });
  }

  const eventTiers = savedEvent?.tiers ?? [];
  const derivedTiers = chosenTemplate ? summarizeVenueLayoutTiers(chosenTemplate, eventTiers) : [];
  const estimatedFee =
    venueLayoutRules && venueLayoutRules.length > 0
      ? calculatePlatformFee(data.tiers, venueLayoutRules)
      : null;

  const hasPricedTier = data.tiers.some(tier => tier.name.trim() && parseFloat(tier.price) > 0);
  const canCreateForEvent = !!savedEventId && hasPricedTier;

  async function handleCreateForEvent() {
    if (!canCreateForEvent || !savedEventId) return;
    const newId = await createTemplate({
      name: `${data.title || 'Event'} layout`,
      canvasWidth: 1000,
      canvasHeight: 700,
    });
    onChange({venueLayoutTemplateId: newId});
    window.open(`/${locale}/events/venue-layouts/${newId}?forEventId=${savedEventId}`, '_blank');
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={data.seatMapEnabled}
          onChange={e => toggle(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <span>
          <span className="block text-sm font-semibold text-gray-900">
            {t('toggleLabel')}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {estimatedFee && estimatedFee.totalFee > 0
              ? t('toggleFeeHint', {
                  fee: estimatedFee.totalFee.toFixed(2),
                  currency: estimatedFee.currency ?? '',
                })
              : t('toggleHint')}
          </span>
        </span>
      </label>

      {data.seatMapEnabled && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <Select
            value={data.venueLayoutTemplateId ?? ''}
            onChange={e =>
              onChange({
                venueLayoutTemplateId: e.target.value
                  ? (e.target.value as Id<'venueLayoutTemplates'>)
                  : null,
              })
            }
          >
            <option value="">{t('choosePlaceholder')}</option>
            {templates?.map(template => (
              <option key={template._id} value={template._id}>{template.name}</option>
            ))}
          </Select>

          {data.venueLayoutTemplateId && chosenTemplate && !chosenTemplate.isSnapshot && (
            <Link
              href={`/events/venue-layouts/${data.venueLayoutTemplateId}`}
              target="_blank"
              className="inline-block text-xs font-medium text-gray-600 underline underline-offset-2"
            >
              {t('manageLink')}
            </Link>
          )}

          {canCreateForEvent ? (
            <button
              type="button"
              onClick={handleCreateForEvent}
              className="inline-block text-xs font-medium text-gray-600 underline underline-offset-2"
            >
              {t('createNewLink')}
            </button>
          ) : (
            <p className="text-xs text-gray-400">{t('saveDraftFirstHint')}</p>
          )}

          {!canCreateForEvent && (
            <Link
              href="/events/venue-layouts"
              target="_blank"
              className="inline-block text-xs font-medium text-gray-600 underline underline-offset-2"
            >
              {t('browseExistingLink')}
            </Link>
          )}

          {chosenTemplate?.isSnapshot && savedEventId ? (
            <VenueLayoutTierMappingPanel
              eventId={savedEventId}
              template={chosenTemplate}
              ticketTiers={eventTiers}
            />
          ) : (
            chosenTemplate && (
              <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-700">{t('previewHeading')}</p>
                {derivedTiers.length === 0 ? (
                  <p className="text-xs text-gray-400">{t('previewEmpty')}</p>
                ) : (
                  derivedTiers.map(tier => (
                    <div key={tier.tierId} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: tier.color}} />
                      <span className="font-medium">{tier.name}</span>
                      {tier.price !== null && <span>{tier.price} {tier.currency}</span>}
                      <span className="text-gray-400">· {t('previewQuantity', {count: tier.quantity})}</span>
                    </div>
                  ))
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
