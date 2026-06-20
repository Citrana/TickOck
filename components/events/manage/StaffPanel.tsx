'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {STAFF_PRESETS, type StaffPreset} from '@/convex/eventStaff';
import {parseConvexError} from '@/lib/errors';
import DataTable, {ColumnDef} from '@/components/ui/DataTable';

type Props = {eventId: Id<'events'>};

const PRESET_KEYS: StaffPreset[] = ['co_organizer', 'scanner', 'finance'];

const PERMISSION_LABEL_KEY: Record<string, string> = {
  'tickets:read': 'permissionTicketsRead',
  'tickets:scan': 'permissionTicketsScan',
  'payments:view': 'permissionPaymentsView',
  'payments:confirm': 'permissionPaymentsConfirm',
  'payments:reject': 'permissionPaymentsReject',
};

type StaffMember = NonNullable<
  ReturnType<typeof useQuery<typeof api.eventStaff.listByEvent>>
>[number];

export default function StaffPanel({eventId}: Props) {
  const t = useTranslations('manage.staff');
  const tPagination = useTranslations('ui.pagination');
  const staff = useQuery(api.eventStaff.listByEvent, {eventId});
  const addStaffMutation = useMutation(api.eventStaff.addStaff);
  const deactivateStaffMutation = useMutation(api.eventStaff.deactivateStaff);
  const reactivateStaffMutation = useMutation(api.eventStaff.reactivateStaff);

  const [email, setEmail] = useState('');
  const [preset, setPreset] = useState<StaffPreset>('co_organizer');
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<Id<'eventStaff'> | null>(null);

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
      toast.error(t('errors.emailRequired'));
      return;
    }
    setAdding(true);
    try {
      await addStaffMutation({
        eventId,
        email: email.trim(),
        permissionSlugs: [...STAFF_PRESETS[preset]],
      });
      setEmail('');
      toast.success(t('addSuccess'));
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('errors.addFailed')));
    } finally {
      setAdding(false);
    }
  }

  async function handleDeactivate(staffId: Id<'eventStaff'>) {
    setTogglingId(staffId);
    try {
      await deactivateStaffMutation({staffId});
      toast.success(t('deactivateSuccess'));
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('errors.deactivateFailed')));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleReactivate(staffId: Id<'eventStaff'>) {
    setTogglingId(staffId);
    try {
      await reactivateStaffMutation({staffId});
      toast.success(t('reactivateSuccess'));
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('errors.reactivateFailed')));
    } finally {
      setTogglingId(null);
    }
  }

  const columns: ColumnDef<StaffMember>[] = [
    {
      key: 'member',
      header: t('memberName'),
      render: member => (
        <div>
          <p className="font-medium text-gray-900">{member.userName ?? member.userEmail}</p>
          {member.userName && (
            <p className="text-xs text-gray-400">{member.userEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: 'permissions',
      header: t('memberRole'),
      render: member => (
        <div className="flex flex-wrap gap-1">
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
      ),
    },
    {
      key: 'status',
      header: t('statusLabel'),
      render: member =>
        member.isActive ? null : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
            {t('inactiveBadge')}
          </span>
        ),
    },
  ];

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
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
              }}
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

          <button
            onClick={handleAdd}
            disabled={adding}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {adding ? t('adding') : t('addButton')}
          </button>
        </div>
      </div>

      {/* Staff table */}
      <DataTable
        columns={columns}
        data={staff}
        pageSize={10}
        getRowKey={member => member._id}
        getRowClassName={member => (!member.isActive ? 'opacity-60' : '')}
        emptyMessage={t('empty')}
        renderActions={member =>
          member.isActive ? (
            <button
              onClick={() => handleDeactivate(member._id)}
              disabled={togglingId === member._id}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40"
            >
              {togglingId === member._id ? t('deactivatingButton') : t('deactivateButton')}
            </button>
          ) : (
            <button
              onClick={() => handleReactivate(member._id)}
              disabled={togglingId === member._id}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-green-300 hover:text-green-700 disabled:opacity-40"
            >
              {togglingId === member._id ? t('reactivatingButton') : t('reactivateButton')}
            </button>
          )
        }
        previousLabel={tPagination('previous')}
        nextLabel={tPagination('next')}
        formatResults={(from, to, total) => tPagination('results', {from, to, total})}
      />
    </div>
  );
}
