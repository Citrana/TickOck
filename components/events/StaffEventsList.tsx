'use client';

import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import Image from 'next/image';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';
import {STAFF_PRESETS, StaffPreset} from '@/convex/eventStaff';
import EventStatusBadge from './EventStatusBadge';

function inferRole(slugs: string[]): StaffPreset | null {
  const set = new Set(slugs);
  for (const [preset, perms] of Object.entries(STAFF_PRESETS) as [StaffPreset, readonly string[]][]) {
    if (perms.length === slugs.length && (perms as readonly string[]).every(p => set.has(p))) {
      return preset;
    }
  }
  return null;
}

export default function StaffEventsList() {
  const t = useTranslations('staffEvents');
  const events = useQuery(api.eventStaff.getMyStaffEvents);

  if (events === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
        <p className="text-sm text-gray-500">{t('empty')}</p>
        <Link
          href="/events"
          className="mt-4 inline-block rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Browse events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map(record => {
        const date = new Date(record.date).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        const role = inferRole(record.permissionSlugs);
        const isActive = record.isActive;

        return (
          <div
            key={record.staffId}
            className="flex gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Cover image */}
            <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {record.coverImageUrl ? (
                <Image
                  src={record.coverImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl text-gray-300">
                  🎟
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{record.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {date} · {record.venue.city}
                  </p>
                </div>
                <EventStatusBadge status={record.status} />
              </div>

              {/* Role + inactive badge */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {role ? (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    {t(`roles.${role}`)}
                  </span>
                ) : (
                  record.permissionSlugs.map(slug => (
                    <span
                      key={slug}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {slug}
                    </span>
                  ))
                )}
                {!isActive && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    {t('inactiveBadge')}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3">
                {isActive ? (
                  <Link
                    href={`/events/${record.eventId}/manage`}
                    className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-50"
                  >
                    {t('actions.manage')}
                  </Link>
                ) : (
                  <span
                    title={t('inactiveNote')}
                    className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400 opacity-50"
                  >
                    {t('actions.manage')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
