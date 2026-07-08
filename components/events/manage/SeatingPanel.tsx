'use client';

import dynamic from 'next/dynamic';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';

const LayoutCanvas = dynamic(() => import('@/components/venue/canvas/LayoutCanvas'), {ssr: false});

type Props = {eventId: Id<'events'>};

export default function SeatingPanel({eventId}: Props) {
  const t = useTranslations('manage.seating');
  const snapshot = useQuery(api.venueLayout.getSnapshotForEvent, {eventId});

  if (snapshot === undefined) {
    return <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />;
  }

  if (snapshot === null) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
        {t('noLayout')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{snapshot.name}</h3>
        <p className="text-xs text-gray-400">{t('lockedNotice')}</p>
      </div>
      <LayoutCanvas
        canvasWidth={snapshot.canvasWidth}
        canvasHeight={snapshot.canvasHeight}
        sections={snapshot.sections}
        tiers={snapshot.tiers}
        seats={snapshot.seats}
        mode="select"
      />
    </div>
  );
}
