import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import VenueLayoutBuilder from '@/components/venue/VenueLayoutBuilder';
import {Id} from '@/convex/_generated/dataModel';

type Props = {
  params: {locale: string; layoutId: string};
  searchParams: {forEventId?: string};
};

export default async function VenueLayoutBuilderPage({params, searchParams}: Props) {
  const {locale, layoutId} = params;
  const token = await convexAuthNextjsToken();
  if (!token) redirect(`/${locale}/login`);

  return (
    <div className="py-4">
      <VenueLayoutBuilder
        layoutId={layoutId as Id<'venueLayoutTemplates'>}
        forEventId={searchParams.forEventId as Id<'events'> | undefined}
      />
    </div>
  );
}
