'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {Link, useRouter} from '@/lib/navigation';
import {parseConvexError} from '@/lib/errors';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FormField from '@/components/ui/FormField';
import Banner from '@/components/ui/Banner';

export default function VenueLayoutList() {
  const t = useTranslations('venueLayout.list');
  const templates = useQuery(api.venueLayout.listMineForAttach, {});
  const createTemplate = useMutation(api.venueLayout.createTemplate);
  const duplicateTemplate = useMutation(api.venueLayout.duplicateTemplate);
  const deleteTemplate = useMutation(api.venueLayout.deleteTemplate);
  const router = useRouter();

  const featureFlags = useQuery(api.featureFlags.list);
  const featureDisabled = featureFlags?.find(f => f.key === 'venue_layout_design')?.enabled === false;

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: Id<'venueLayoutTemplates'>;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTemplate({layoutId: pendingDelete.id});
      toast.success(t('deleteSuccess'));
      setPendingDelete(null);
    } catch (err: unknown) {
      toast.error(parseConvexError(err, t('deleteFailed')));
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = await createTemplate({
        name: name.trim(),
        canvasWidth: 1000,
        canvasHeight: 700,
      });
      router.push(`/events/venue-layouts/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('heading')}</h1>
        <Button type="button" onClick={() => setShowCreate(true)} disabled={featureDisabled}>
          {t('createButton')}
        </Button>
      </div>

      {featureDisabled && <Banner>{t('disabledNotice')}</Banner>}

      {templates === undefined ? (
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      ) : templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          {t('empty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <div key={template._id} className="rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {template.status === 'published' ? t('published') : t('draft')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/events/venue-layouts/${template._id}`}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-200"
                >
                  {t('open')}
                </Link>
                <button
                  type="button"
                  disabled={featureDisabled}
                  onClick={() => duplicateTemplate({layoutId: template._id, newName: `${template.name} (copy)`})}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('duplicate')}
                </button>
                <button
                  type="button"
                  disabled={featureDisabled}
                  onClick={() => setPendingDelete({id: template._id, name: template.name})}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('createModalTitle')}>
        <div className="space-y-4">
          <FormField label={t('nameLabel')} required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
              {t('create')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('deleteConfirmTitle')}
        message={t('deleteConfirmMessage', {name: pendingDelete?.name ?? ''})}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        confirming={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
