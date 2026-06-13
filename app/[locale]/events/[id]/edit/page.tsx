import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Id} from '@/convex/_generated/dataModel';
import CreateEventForm from '@/components/events/CreateEventForm';

type Props = {
  params: {locale: string; id: string};
};

export default async function EditEventPage({params}: Props) {
  const {locale, id} = params;
  const token = await convexAuthNextjsToken();
  if (!token) redirect(`/${locale}/login`);

  const t = await getTranslations('eventCreate');

  return (
    <div className="py-4">
      <div className="mx-auto max-w-2xl mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          {t('editPageTitle')}
        </h1>
        <p className="mt-2 text-base text-gray-500">{t('pageSubtitle')}</p>
      </div>
      <CreateEventForm existingEventId={id as Id<'events'>} locale={locale} />
    </div>
  );
}
