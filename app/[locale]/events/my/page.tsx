import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';
import MyEventsList from '@/components/events/MyEventsList';

type Props = {params: {locale: string}};

export default async function MyEventsPage({params}: Props) {
  const {locale} = params;
  const token = await convexAuthNextjsToken();
  if (!token) redirect(`/${locale}/login`);

  const t = await getTranslations('myEvents');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <Link
          href="/events/create"
          className="btn-ticket rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          + {t('createNew')}
        </Link>
      </div>

      <MyEventsList />
    </div>
  );
}
