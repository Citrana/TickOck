import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import VenueLayoutList from '@/components/venue/VenueLayoutList';

type Props = {
  params: {locale: string};
};

export default async function VenueLayoutsPage({params}: Props) {
  const {locale} = params;
  const token = await convexAuthNextjsToken();
  if (!token) redirect(`/${locale}/login`);

  return (
    <div className="py-4">
      <VenueLayoutList />
    </div>
  );
}
