import {getTranslations} from 'next-intl/server';
import FeatureFlagsManager from '@/components/admin/FeatureFlagsManager';

export default async function AdminFeatureFlagsPage() {
  const t = await getTranslations('admin.featureFlags');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('pageSubtitle')}</p>
      <FeatureFlagsManager />
    </div>
  );
}
