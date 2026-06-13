'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {STAFF_PRESETS, type StaffPreset} from '@/convex/eventStaff';

type Props = {eventId: Id<'events'>};

const PRESET_KEYS: StaffPreset[] = ['co_organizer', 'scanner', 'finance'];

const PERMISSION_LABEL_KEY: Record<string, string> = {
  'tickets:read': 'permissionTicketsRead',
  'tickets:scan': 'permissionTicketsScan',
  'payments:view': 'permissionPaymentsView',
  'payments:confirm': 'permissionPaymentsConfirm',
  'payments:reject': 'permissionPaymentsReject',
};

export default function StaffPanel({eventId}: Props) {
  const t = useTranslations('manage.staff');
  const staff = useQuery(api.eventStaff.listByEvent, {eventId});
  const addStaffMutation = useMutation(api.eventStaff.addStaff);
  const removeStaffMutation = useMutation(api.eventStaff.removeStaff);

  const [email, setEmail] = useState('');
  const [preset, setPreset] = useState<StaffPreset>('co_organizer');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<Id<'eventStaff'> | null>(null);
  const [addError, setAddError] = useState('');

  if (staff === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({length: 2}).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  async function handleAdd() {
    if (!email.trim()) {
      setAddError(t('errors.emailRequired'));
      return;
    }
    setAddError('');
    setAdding(true);
    try {
      await addStaffMutation({
        eventId,
        email: email.trim(),
        permissionSlugs: [...STAFF_PRESETS[preset]],
      });
      setEmail('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t('errors.addFailed'));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(staffId: Id<'eventStaff'>) {
    setRemovingId(staffId);
    try {
      await removeStaffMutation({staffId});
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Add staff form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900">{t('addTitle')}</h3>
        <div className="mt-4 space-y-4">
          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {t('emailLabel')}
            </label>
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          {/* Role preset cards */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">
              {t('roleLabel')}
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRESET_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    preset === key
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'
                  }`}
                >
                  <p className="text-xs font-semibold">
                    {t(`roles.${key}` as Parameters<typeof t>[0])}
                  </p>
                  <p
                    className={`mt-0.5 text-[11px] leading-snug ${preset === key ? 'text-gray-300' : 'text-gray-500'}`}
                  >
                    {t(`roleDescriptions.${key}` as Parameters<typeof t>[0])}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {addError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{addError}</p>
          )}

          <button
            onClick={handleAdd}
            disabled={adding}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {adding ? t('adding') : t('addButton')}
          </button>
        </div>
      </div>

      {/* Current staff list */}
      {staff.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          {t('empty')}
        </p>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {staff.map(member => {
            const isRemoving = removingId === member._id;

            return (
              <div key={member._id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {member.userName ?? member.userEmail}
                  </p>
                  {member.userName && (
                    <p className="text-xs text-gray-400">{member.userEmail}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {member.permissionSlugs.map(slug => (
                      <span
                        key={slug}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                      >
                        {PERMISSION_LABEL_KEY[slug]
                          ? t(PERMISSION_LABEL_KEY[slug] as Parameters<typeof t>[0])
                          : slug}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(member._id)}
                  disabled={isRemoving}
                  className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                >
                  {isRemoving ? t('removing') : t('removeButton')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
