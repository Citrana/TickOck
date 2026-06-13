import {getTranslations} from 'next-intl/server';
import {Link} from '@/lib/navigation';
import Image from 'next/image';

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

export default async function HomePage() {
  const t = await getTranslations('hero');

  return (
    <section className="py-6">
      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-14">

        {/* ── Left: copy ── */}
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
              className="rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
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

        {/* ── Right: animated image mosaic ── */}
        <div
          className="relative hidden overflow-hidden md:block"
          style={{height: 'min(calc(100vh - 180px), 580px)'}}
        >
          {/* Left strip — scrolls down */}
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

          {/* Right strip — scrolls up, offset for stagger */}
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

          {/* Decorative cross */}
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
  );
}
