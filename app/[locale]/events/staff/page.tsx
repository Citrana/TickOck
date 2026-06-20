import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import StaffEventsList from '@/components/events/StaffEventsList';

type Props = {params: {locale: string}};

export default async function StaffEventsPage({params}: Props) {
  const {locale} = params;
  const token = await convexAuthNextjsToken();
  if (!token) redirect(`/${locale}/login`);

  const t = await getTranslations('staffEvents');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <StaffEventsList />
    </div>
  );
}
