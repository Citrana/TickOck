import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import Image from 'next/image';
import { Fraunces } from 'next/font/google';
import WhySection from '@/components/marketing/WhySection';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

// ── Hero image arrays (unchanged) ──────────────────────────────────────────
const leftImages = [
  {
    src: '/images/event-1.jpg',
    aspect: 'aspect-[4/3]',
    shape: 'rounded-tl-2xl rounded-tr-full rounded-br-full rounded-bl-2xl',
  },
  {
    src: '/images/event-3.jpg',
    aspect: 'aspect-[3/4]',
    shape: 'rounded-tl-full rounded-tr-2xl rounded-br-2xl rounded-bl-full',
  },
  {
    src: '/images/event-4.jpg',
    aspect: 'aspect-square',
    shape: 'rounded-tl-2xl rounded-tr-3xl rounded-br-full rounded-bl-full',
  },
  {
    src: '/images/event-5.jpg',
    aspect: 'aspect-[4/3]',
    shape: 'rounded-tl-full rounded-tr-full rounded-br-3xl rounded-bl-2xl',
  },
];

const rightImages = [
  {
    src: '/images/event-6.jpg',
    aspect: 'aspect-[3/4]',
    shape: 'rounded-tl-3xl rounded-tr-full rounded-br-full rounded-bl-3xl',
  },
  {
    src: '/images/event-7.jpg',
    aspect: 'aspect-[4/3]',
    shape: 'rounded-tl-full rounded-tr-2xl rounded-br-3xl rounded-bl-full',
  },
  {
    src: '/images/event-8.jpg',
    aspect: 'aspect-[3/4]',
    shape: 'rounded-tl-2xl rounded-tr-full rounded-br-2xl rounded-bl-full',
  },
];

// ── Stats cards ─────────────────────────────────────────────────────────────
const statsCards = [
  { key: 'firstTimers', bg: 'bg-rose-200', radius: 'rounded-tl-3xl rounded-tr-xl  rounded-br-3xl rounded-bl-xl' },
  { key: 'eventPros', bg: 'bg-amber-50', radius: 'rounded-tl-xl  rounded-tr-3xl rounded-br-xl  rounded-bl-3xl' },
  { key: 'freeEvents', bg: 'bg-yellow-200', radius: 'rounded-tl-3xl rounded-tr-3xl rounded-br-xl  rounded-bl-xl' },
  { key: 'developers', bg: 'bg-teal-100', radius: 'rounded-tl-xl  rounded-tr-xl  rounded-br-3xl rounded-bl-3xl' },
  { key: 'charities', bg: 'bg-orange-200', radius: 'rounded-tl-3xl rounded-tr-xl  rounded-br-xl  rounded-bl-3xl' },
  { key: 'attractions', bg: 'bg-white', radius: 'rounded-tl-xl  rounded-tr-3xl rounded-br-3xl rounded-bl-xl' },
] satisfies Array<{ key: string; bg: string; radius: string }>;

// ── Sample event cards for Discover section ──────────────────────────────────
const sampleEvents = [
  {
    gradient: 'from-rose-300 to-orange-300',
    title: 'Summer Music Festival 2025',
    date: 'SAT 12 JULY',
    venue: 'Central Park, New York',
    organizer: 'EventCo Productions',
  },
  {
    gradient: 'from-violet-300 to-blue-300',
    title: 'Boston Food & Drink Festival',
    date: 'SUN 20 JULY',
    venue: 'City Hall Plaza, Boston',
    organizer: 'FoodFest Inc.',
  },
  {
    gradient: 'from-emerald-300 to-teal-300',
    title: 'The Wellington Jazz Festival',
    date: 'FRI 1 AUG',
    venue: 'Wellington Town Hall',
    organizer: 'Jazz Society NZ',
  },
];

// ── Integration placeholder grid ─────────────────────────────────────────────
const integrationColors = [
  'bg-rose-100', 'bg-orange-100', 'bg-amber-100', 'bg-yellow-100',
  'bg-lime-100', 'bg-green-100', 'bg-emerald-100', 'bg-teal-100',
  'bg-cyan-100', 'bg-sky-100', 'bg-blue-100', 'bg-indigo-100',
  'bg-violet-100', 'bg-purple-100', 'bg-fuchsia-100', 'bg-pink-100',
];

export default async function HomePage() {
  const t = await getTranslations('hero');
  const th = await getTranslations('home');

  return (
    <div className={fraunces.className}>
      {/* ── HERO (unchanged) ─────────────────────────────────────────────── */}
      <section className="py-6">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-14">

          {/* Left: copy */}
          <div>
            <svg
              className="mb-5 h-5 w-5 text-gray-300"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M10 2v16M2 10h16" />
            </svg>

            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.5rem]">
              {t('headlineStart')}{' '}
              <span className="rounded-lg bg-rose-200 px-2 py-0.5 italic">
                {t('headlineHighlight1')}
              </span>{' '}
              <span className="rounded-lg bg-orange-200 px-2 py-0.5 italic">
                {t('headlineHighlight2')}
              </span>{' '}
              {t('headlineEnd')}
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-gray-600 lg:text-lg">
              {t('subtitle')}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="btn-ticket rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
              >
                {t('ctaPrimary')}
              </Link>
              <Link
                href="#demo"
                className="text-sm font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-600"
              >
                {t('ctaSecondary')}
              </Link>
            </div>

            <div className="mt-10 border-t border-gray-200 pt-7">
              <p className="mb-4 text-sm font-medium text-gray-500">
                {t('socialProof')}
              </p>
              <div className="flex flex-wrap items-start gap-7">
                <div>
                  <p className="text-sm text-amber-400">★★★★★</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">{t('ratingScore1')}</p>
                  <p className="text-xs text-gray-500">{t('ratingGoogle')}</p>
                </div>
                <div>
                  <p className="text-sm text-amber-400">★★★★★</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">{t('ratingScore2')}</p>
                  <p className="text-xs text-gray-500">{t('ratingCapterra')}</p>
                </div>
                <div>
                  <p className="text-sm text-amber-400">★★★★★</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">{t('ratingScore3')}</p>
                  <p className="text-xs text-gray-500">{t('ratingG2')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: animated image mosaic */}
          <div
            className="relative hidden overflow-hidden md:block"
            style={{ height: 'min(calc(100vh - 180px), 580px)' }}
          >
            <div className="absolute left-0 top-0 w-[47%]">
              <div className="animate-scroll-down flex flex-col gap-3">
                {[...leftImages, ...leftImages].map((img, i) => (
                  <div
                    key={i}
                    className={`${img.aspect} relative w-full overflow-hidden ${img.shape}`}
                  >
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(min-width: 1280px) 280px, 180px"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute right-0 top-14 w-[47%]">
              <div className="animate-scroll-up flex flex-col gap-3">
                {[...rightImages, ...rightImages].map((img, i) => (
                  <div
                    key={i}
                    className={`${img.aspect} relative w-full overflow-hidden ${img.shape}`}
                  >
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(min-width: 1280px) 280px, 180px"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </div>

            <svg
              className="absolute bottom-4 left-4 z-10 h-5 w-5 text-gray-400/60"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M10 2v16M2 10h16" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── PLATFORM INTRO ───────────────────────────────────────────────── */}
      <div className="full-bleed bg-gray-900 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            {th('platform.label')}
          </p>
          <h2 className="mx-auto max-w-3xl text-center text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
            {th('platform.headline')}{' '}
            <span className="relative whitespace-nowrap">
              <span className="relative text-amber-400 italic">{th('platform.headlineHighlight')}</span>
            </span>{' '}
            {th('platform.headlineEnd')}
          </h2>

          {/* Central image */}
          <div className="mt-14 flex justify-center">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
              <Image
                src="/images/center-image.png"
                alt=""
                width={500}
                height={200}
                className="w-full"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS + FEATURE CARDS ────────────────────────────────────────── */}
      <div className="full-bleed bg-gray-900 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Heading + subtitle */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-end">
            <h2 className="text-4xl font-black leading-[1.1] text-white sm:text-5xl lg:text-6xl">
              {th('stats.headline')}{' '}
              <span className="rounded-xl bg-amber-300 px-2 py-0.5 text-gray-900">
                {th('stats.count')}
              </span>
              <br />
              <span className="rounded-xl bg-amber-300 px-2 py-0.5 text-gray-900">
                {th('stats.countLabel')}
              </span>{' '}
              {th('stats.across')}
              <br />
              {th('stats.countries')} {th('stats.countriesLabel')}
            </h2>
            <p className="text-base leading-relaxed text-gray-300 sm:text-lg lg:pb-2">
              {th('stats.subtitle')}
            </p>
          </div>

          {/* Cards */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statsCards.map(card => (
              <div
                key={card.key}
                className={`${card.bg} ${card.radius} flex flex-col p-7`}
              >
                <h3 className="text-xl font-black text-gray-900">
                  {th(`stats.${card.key}.title`)}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
                  {th(`stats.${card.key}.desc`)}
                </p>
                <span className="mt-6 text-sm font-bold text-gray-900 underline underline-offset-2 cursor-pointer">
                  {th('stats.learnMore')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEES ─────────────────────────────────────────────────────────── */}
      <div className="full-bleed bg-[#f9f7f4] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6 text-4xl" aria-hidden="true">🐝</div>
          <p className="mx-auto max-w-2xl text-2xl font-bold leading-relaxed text-gray-900 sm:text-3xl">
            {th('fees.headline')}
          </p>
          <div className="mt-10">
            <Link
              href="/pricing"
              className="inline-block rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
            >
              {th('fees.cta')}
            </Link>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {th('howItWorks.label')}
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {th('howItWorks.headline')} 🚀
          </h2>
        </div>

        {/* Feature 1: left image, right text */}
        <div className="mb-20 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <Image
              src="/images/create-your-event.png"
              alt=""
              width={1200}
              height={900}
              className="w-full h-auto"
            />
          </div>

          <div>
            <h3 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {th('howItWorks.feature1.title')}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-base">
              {th('howItWorks.feature1.desc')}
            </p>
            <ul className="mt-6 space-y-4">
              {(['bullet1', 'bullet2', 'bullet3'] as const).map(b => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                    ✓
                  </span>
                  <span className="text-sm leading-relaxed text-gray-600">
                    {th(`howItWorks.feature1.${b}`)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-600"
            >
              {th('howItWorks.feature1.cta')} →
            </Link>
          </div>
        </div>

        {/* Feature 2: left text, right mockup */}
        <div className="mb-20 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h3 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {th('howItWorks.feature2.title')}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-base">
              {th('howItWorks.feature2.desc')}
            </p>
            <ul className="mt-6 space-y-4">
              {(['bullet1', 'bullet2', 'bullet3'] as const).map(b => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                    ✓
                  </span>
                  <span className="text-sm leading-relaxed text-gray-600">
                    {th(`howItWorks.feature2.${b}`)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-600"
            >
              {th('howItWorks.feature2.cta')} →
            </Link>
          </div>

          <div className="order-1 overflow-hidden rounded-2xl lg:order-2">
            <Image
              src="/images/event-details.png"
              alt=""
              width={1200}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Feature 3: left image, right text */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl">
            <Image
              src="/images/manage-order.png"
              alt=""
              width={1200}
              height={900}
              className="w-full h-auto"
            />
          </div>

          <div>
            <h3 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {th('howItWorks.feature3.title')}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-base">
              {th('howItWorks.feature3.desc')}
            </p>
            <ul className="mt-6 space-y-4">
              {(['bullet1', 'bullet2', 'bullet3'] as const).map(b => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                    ✓
                  </span>
                  <span className="text-sm leading-relaxed text-gray-600">
                    {th(`howItWorks.feature3.${b}`)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/events"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 underline underline-offset-4 hover:text-gray-600"
            >
              {th('howItWorks.feature3.cta')} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── DISCOVER LIVE EVENTS ─────────────────────────────────────────── */}
      <div className="full-bleed bg-gray-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {th('discover.headline')}
            </h2>
            <Link
              href="/events"
              className="text-sm font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-900"
            >
              {th('discover.cta')} →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sampleEvents.map(event => (
              <div
                key={event.title}
                className="group overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className={`aspect-video bg-gradient-to-br ${event.gradient}`} />
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {event.date}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-gray-900 transition-colors group-hover:text-rose-600">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{event.venue}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gray-200" aria-hidden="true" />
                    <p className="text-xs text-gray-400">{event.organizer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHY USE TICKOCK ──────────────────────────────────────────────── */}
      <WhySection
        headline={th('why.headline')}
        tabs={[
          {
            id: 'pricing',
            color: 'bg-rose-200',
            stripLabel: th('why.tabs.pricing.stripLabel'),
            label: th('why.tabs.pricing.label'),
            title: th('why.tabs.pricing.title'),
            desc: th('why.tabs.pricing.desc'),
            cta: th('why.tabs.pricing.cta'),
            href: '/pricing',
            image: '/images/why-us-1.jpg',
          },
          {
            id: 'support',
            color: 'bg-teal-100',
            stripLabel: th('why.tabs.support.stripLabel'),
            label: th('why.tabs.support.label'),
            title: th('why.tabs.support.title'),
            desc: th('why.tabs.support.desc'),
            cta: th('why.tabs.support.cta'),
            href: '#',
            image: '/images/why-us-2.jpg',
          },
          {
            id: 'features',
            color: 'bg-yellow-200',
            stripLabel: th('why.tabs.features.stripLabel'),
            label: th('why.tabs.features.label'),
            title: th('why.tabs.features.title'),
            desc: th('why.tabs.features.desc'),
            cta: th('why.tabs.features.cta'),
            href: '#',
            image: '/images/why-us-3.jpg',
          },
        ]}
      />

      {/* ── TESTIMONIAL ──────────────────────────────────────────────────── */}
      <div className="full-bleed bg-gray-900 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <svg
            className="mx-auto mb-8 h-12 w-12 text-gray-700"
            viewBox="0 0 48 48"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 22c0-5.52 4.48-10 10-10V8C13.6 8 6 15.6 6 24v16h12V22zm20 0c0-5.52 4.48-10 10-10V8c-8.4 0-16 7.6-16 16v16h12V22h-6z" />
          </svg>
          <blockquote className="text-xl font-medium italic leading-relaxed text-white sm:text-2xl lg:text-3xl">
            &ldquo;{th('testimonial.quote')}&rdquo;
          </blockquote>
          <div className="mt-8">
            <p className="font-bold text-white">{th('testimonial.author')}</p>
            <p className="mt-1 text-sm text-gray-400">{th('testimonial.role')}</p>
          </div>
          <Link
            href="/reviews"
            className="mt-8 inline-block text-sm font-semibold text-amber-400 underline underline-offset-4 hover:text-amber-300"
          >
            {th('testimonial.cta')}
          </Link>
        </div>
      </div>

      {/* ── INTEGRATIONS ─────────────────────────────────────────────────── */}
      <section id="integrations" className="py-20 sm:py-28 text-center">
        <h2 className="mx-auto max-w-2xl text-2xl font-extrabold text-gray-900 sm:text-3xl lg:text-4xl">
          {th('integrations.headline')}{' '}
          <span className="text-rose-500">{th('integrations.highlight')}</span>{' '}
          {th('integrations.headlineEnd')}
        </h2>

        <div className="mt-12 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {integrationColors.map((color, i) => (
            <div
              key={i}
              className={`aspect-square rounded-xl ${color} flex items-center justify-center`}
            >
              <div className="h-7 w-7 rounded-lg bg-white/60" aria-hidden="true" />
            </div>
          ))}
        </div>

        <Link
          href="/integrations"
          className="mt-10 inline-block rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          {th('integrations.cta')}
        </Link>
      </section>

      {/* ── CTA BANNER (last section — flush with footer) ────────────────── */}
      <div className="full-bleed -mb-8 bg-gray-900 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Decorative dots */}
          <div className="mb-8 flex justify-center gap-2" aria-hidden="true">
            {['bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-blue-400', 'bg-violet-400'].map(c => (
              <div key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
            ))}
          </div>

          <h2 className="text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl">
            <span className="block">{th('ctaBanner.headline1')}</span>
            <span className="mt-2 block text-amber-400">{th('ctaBanner.headline2')}</span>
          </h2>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="btn-ticket rounded-lg bg-white px-8 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              {th('ctaBanner.cta1')}
            </Link>
            <Link
              href="/demo"
              className="rounded-lg border border-gray-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:border-gray-400 hover:text-gray-200"
            >
              {th('ctaBanner.cta2')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
