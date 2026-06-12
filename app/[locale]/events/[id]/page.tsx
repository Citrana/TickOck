import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';

export default async function EventDetailPage({
  params,
}: {
  params: {id: string};
}) {
  const t = await getTranslations('events.detail');

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900">Event #{params.id}</h1>
      <dl className="mt-6 space-y-3 text-sm text-gray-600">
        <div className="flex gap-2">
          <dt className="font-medium">{t('date')}:</dt>
          <dd>—</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">{t('location')}:</dt>
          <dd>—</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">{t('organizer')}:</dt>
          <dd>—</dd>
        </div>
      </dl>
      <div className="mt-8">
        <Link
          href="/checkout"
          className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('buyButton')}
        </Link>
      </div>
    </div>
  );
}
