import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {redirect} from 'next/navigation';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await convexAuthNextjsToken();
  if (!token) redirect('/auth/login');

  return (
    <AdminGuard>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <AdminSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
