import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';

export default async function AdminPage() {
  const t = await getTranslations('admin');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminCard label={t('events')} href="/admin/events" />
        <AdminCard label={t('users')} href="/admin/users" />
        <AdminCard label={t('payments')} href="/admin/payments" />
        <AdminCard label={t('pendingPayments')} href="/admin/payments/pending" />
        <AdminCard label={t('auditLog')} href="/admin/audit" />
      </div>
    </div>
  );
}

function AdminCard({label, href}: {label: string; href: string}) {
  return (
    <Link
      href={href as '/'}
      className="block rounded-lg border border-gray-200 bg-white p-6 text-sm font-medium text-gray-800 shadow-sm hover:shadow-md transition-shadow"
    >
      {label}
    </Link>
  );
}
