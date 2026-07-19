import {getTranslations} from 'next-intl/server';
import VenueLayoutsReport from '@/components/admin/VenueLayoutsReport';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'admin.venueLayoutsReport'});
  return {title: t('pageTitle')};
}

export default async function AdminVenueLayoutsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'admin.venueLayoutsReport'});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('pageSubtitle')}</p>
      </div>
      <VenueLayoutsReport />
    </div>
  );
}
