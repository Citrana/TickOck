import {getTranslations} from 'next-intl/server';
import PricingManager from '@/components/admin/PricingManager';

export default async function AdminPricingPage() {
  const t = await getTranslations('admin.pricing');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('pageSubtitle')}</p>
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t('platformSectionTitle')}
          </h2>
          <PricingManager category="platform" />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t('venueLayoutSectionTitle')}
          </h2>
          <PricingManager category="venue_layout" />
        </section>
      </div>
    </div>
  );
}
