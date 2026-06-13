'use client';

import {useEffect, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useMutation} from 'convex/react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/navigation';
import {api} from '@/convex/_generated/api';

type State = 'verifying' | 'success' | 'invalid_token' | 'token_expired' | 'error';

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const verify = useMutation(api.emailVerification.verify);

  const [state, setState] = useState<State>('verifying');

  useEffect(() => {
    if (!token) {
      setState('invalid_token');
      return;
    }

    verify({token})
      .then(result => {
        if (result.success) {
          setState('success');
        } else {
          setState(result.error);
        }
      })
      .catch(() => setState('error'));
  // Run once on mount — token from URL params won't change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      {state === 'verifying' && (
        <p className="text-gray-600">{t('verifying')}</p>
      )}

      {state === 'success' && (
        <>
          <p className="text-lg font-medium text-green-700">{t('success')}</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('loginButton')}
          </Link>
        </>
      )}

      {state === 'invalid_token' && (
        <p className="text-red-700">{t('errorInvalidToken')}</p>
      )}

      {state === 'token_expired' && (
        <p className="text-red-700">{t('errorTokenExpired')}</p>
      )}

      {state === 'error' && (
        <p className="text-red-700">{t('errorGeneric')}</p>
      )}
    </div>
  );
}
