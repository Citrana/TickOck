import type {Metadata, Viewport} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import localFont from 'next/font/local';
import {ConvexAuthNextjsServerProvider} from '@convex-dev/auth/nextjs/server';
import '../globals.css';
import Navbar from '@/components/nav/Navbar';
import Footer from '@/components/marketing/Footer';
import {ConvexClientProvider} from '@/components/providers/ConvexClientProvider';
import {AuthGuard} from '@/components/auth/AuthGuard';
import {routing} from '@/i18n/routing';
import {Toaster} from 'sonner';
import {ServiceWorkerRegistration} from '@/components/pwa/ServiceWorkerRegistration';

const geistSans = localFont({
  src: '../fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: '../fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const viewport: Viewport = {
  themeColor: '#111827',
};

export const metadata: Metadata = {
  title: 'TickOck',
  description: 'Bilingual event ticketing platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'TickOck',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({locale}));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const {locale} = params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang={locale}>
        <body
          className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-hidden bg-[#f9f7f4] antialiased`}
        >
          <NextIntlClientProvider messages={messages}>
            <ConvexClientProvider>
              {/* Side-effect guard: signs out suspended/banned users */}
              <AuthGuard />
              <Navbar />
              <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {children}
              </main>
              <Toaster position="top-right" richColors />
            </ConvexClientProvider>
          </NextIntlClientProvider>
          <Footer />
          <ServiceWorkerRegistration />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
