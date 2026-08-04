'use client';

import {useState} from 'react';
import {useAuthActions} from '@convex-dev/auth/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import Input from '@/components/ui/Input';

/**
 * After successful registration the user lands in a pending_verification
 * state. We show an inline banner instead of redirecting so they know to
 * check their inbox before trying to log in.
 */
export function RegisterForm() {
  const t = useTranslations('auth.register');
  const tPending = useTranslations('auth.pendingVerification');
  const {signIn} = useAuthActions();

  const [registered, setRegistered] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const emailVal = form.get('email') as string;
    const password = form.get('password') as string;

    try {
      await signIn('password', {email: emailVal, password, name, flow: 'signUp'});
      setEmail(emailVal);
      setRegistered(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="mx-auto max-w-md py-12">
        <h1 className="text-2xl font-bold text-gray-900">
          {tPending('title')}
        </h1>
        <p className="mt-4 text-sm text-gray-600">
          {tPending('description', {email})}
        </p>
        <p className="mt-6 text-sm text-gray-500">{tPending('logout')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('nameLabel')}
          </label>
          <Input
            type="text"
            name="name"
            required
            autoComplete="name"
            className="mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('emailLabel')}
          </label>
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('passwordLabel')}
          </label>
          <Input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">{t('passwordHint')}</p>
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
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
