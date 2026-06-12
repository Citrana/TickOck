import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';

export default async function RegisterPage() {
  const t = await getTranslations('auth.register');

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <form className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('nameLabel')}
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('emailLabel')}
          </label>
          <input
            type="email"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('passwordLabel')}
          </label>
          <input
            type="password"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('submitButton')}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
