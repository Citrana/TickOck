import {getTranslations} from 'next-intl/server';

export default async function CheckoutPage() {
  const t = await getTranslations('checkout');

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {t('orderSummary')}
          </h2>
          <div className="mt-2 rounded-md border border-gray-200 p-4 text-sm text-gray-600">
            —
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {t('paymentInstructions')}
          </h2>
          <div className="mt-2 rounded-md border border-gray-200 p-4 text-sm text-gray-600">
            —
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('uploadProof')}
          </label>
          <input type="file" className="mt-1 block text-sm text-gray-600" />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('submitButton')}
        </button>
      </section>
    </div>
  );
}
