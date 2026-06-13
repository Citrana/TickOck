import {getTranslations} from 'next-intl/server';
import CheckoutForm from '@/components/checkout/CheckoutForm';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: {event?: string};
}) {
  const t = await getTranslations('checkout');

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">{t('title')}</h1>
      <CheckoutForm eventId={searchParams.event} />
    </div>
  );
}
