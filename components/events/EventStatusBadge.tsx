'use client';

import {useTranslations} from 'next-intl';

type Status = 'draft' | 'pending_approval' | 'live' | 'rejected' | 'ended';

const CLASSES: Record<Status, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  live: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  ended: 'bg-gray-100 text-gray-500',
};

const LABEL_KEY: Record<Status, string> = {
  draft: 'draft',
  pending_approval: 'pendingApproval',
  live: 'live',
  rejected: 'rejected',
  ended: 'ended',
};

export default function EventStatusBadge({status}: {status: Status}) {
  const t = useTranslations('eventStatus');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASSES[status]}`}>
      {t(LABEL_KEY[status])}
    </span>
  );
}
