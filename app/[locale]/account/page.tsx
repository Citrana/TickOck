import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';
import MyEventsList from '@/components/events/MyEventsList';

type Props = {params: {locale: string}};

export default async function AccountPage({params}: Props) {
  const {locale} = params;
  const token = await convexAuthNextjsToken();
  if (!token) redirect(`/${locale}/login`);

  const t = await getTranslations('dashboard');
  const tEvents = await getTranslations('myEvents');

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('welcome')}</p>
      </div>

      {/* My Events */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{tEvents('title')}</h2>
          <Link
            href="/events/my"
            className="text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900"
          >
            {tEvents('viewAllLink')}
          </Link>
        </div>
        <MyEventsList limit={3} />
      </section>

      {/* My Tickets */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-gray-900">{t('recentOrders')}</h2>
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          {t('noTickets')}
        </div>
      </section>
    </div>
  );
}
