'use client';

import {useRouter} from '@/lib/navigation';
import {useEffect} from 'react';
import {useCurrentUser} from '@/hooks/useCurrentUser';

export default function AdminGuard({children}: {children: React.ReactNode}) {
  const {user, isLoading} = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !user.role) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!user?.role) return null;

  return <>{children}</>;
}
