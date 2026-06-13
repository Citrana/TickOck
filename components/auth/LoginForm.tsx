'use client';

import {useState} from 'react';
import {useAuthActions} from '@convex-dev/auth/react';
import {useTranslations} from 'next-intl';
import {Link, useRouter} from '@/lib/navigation';

interface Props {
  /** Set by the verify-email redirect to show a one-time success banner. */
  verified?: boolean;
}

export function LoginForm({verified}: Props) {
  const t = useTranslations('auth.login');
  const {signIn} = useAuthActions();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    try {
      await signIn('password', {email, password, flow: 'signIn'});
      router.push('/');
    } catch (err: unknown) {
      const raw =
        err instanceof Error ? err.message : String(err);

      // ConvexError payloads arrive as JSON strings in the message.
      let code: string | null = null;
      try {
        const parsed = JSON.parse(raw) as {code?: string};
        code = parsed.code ?? null;
      } catch {
        // not a JSON error
      }

      if (code === 'ACCOUNT_SUSPENDED') {
        setError(t('errors.ACCOUNT_SUSPENDED'));
      } else if (code === 'ACCOUNT_BANNED') {
        setError(t('errors.ACCOUNT_BANNED'));
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {verified && (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          {t('verifiedSuccess')}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('emailLabel')}
          </label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('passwordLabel')}
          </label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '…' : t('submitButton')}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-blue-600 hover:underline">
          {t('registerLink')}
        </Link>
      </p>
    </div>
  );
}
