'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MousePointerClick, Wallet, QrCode, CircleCheckBig } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Step = {
  id: string;
  label: string;
  caption: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  buyButtonLabel: string;
  steps: Step[];
};

const SCROLL_DISTANCE = 4500;
const CONFETTI_COLORS = ['bg-rose-300', 'bg-amber-300', 'bg-teal-300', 'bg-orange-300', 'bg-yellow-300', 'bg-rose-200'];

function nonNull<T>(items: (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

export default function TicketJourneySection({ eyebrow, headline, buyButtonLabel, steps }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const buyButtonRef = useRef<HTMLDivElement>(null);
  const tapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const confettiRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const walletBadgeRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerBadgeRef = useRef<HTMLSpanElement>(null);
  const scanLineRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const captionRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const mobileCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px)', () => {
        gsap.set(sheetRef.current, { yPercent: 100 });
        gsap.set(tapRef.current, { opacity: 0, scale: 1.6 });
        gsap.set(ticketRef.current, { opacity: 0, scale: 0 });
        gsap.set(nonNull(confettiRefs.current), { opacity: 0, x: 0, y: 0 });
        gsap.set(walletBadgeRef.current, { opacity: 0, scale: 0 });
        gsap.set(scannerRef.current, { opacity: 0, x: 40 });
        gsap.set(scanLineRef.current, { opacity: 0, xPercent: -100 });
        gsap.set(checkRef.current, { opacity: 0, scale: 0 });
        gsap.set(nonNull(captionRefs.current), { opacity: 0 });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: `+=${SCROLL_DISTANCE}`,
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            onUpdate: self => {
              const index = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
              dotRefs.current.forEach((dot, i) => {
                dot?.classList.toggle('bg-white', i === index);
                dot?.classList.toggle('bg-white/30', i !== index);
              });
              captionRefs.current.forEach((caption, i) => {
                if (caption) caption.style.opacity = i === index ? '1' : '0';
              });
            },
          },
        });

        // Beat 1 — PURCHASE: tap lands on the button, a payment sheet slides up and away
        tl.addLabel('purchase')
          .to(tapRef.current, { opacity: 1, scale: 1, duration: 0.4 })
          .to(buyButtonRef.current, { scale: 0.92, duration: 0.15, yoyo: true, repeat: 1 }, '>-0.1')
          .to(sheetRef.current, { yPercent: 0, duration: 0.6 })
          .to({}, { duration: 0.3 })
          .to(sheetRef.current, { yPercent: 100, duration: 0.4 })
          .to(tapRef.current, { opacity: 0, duration: 0.2 }, '<');

        // Beat 2 — RECEIVED: the ticket pops in with a small confetti burst
        tl.addLabel('received')
          .to(buyButtonRef.current, { opacity: 0, duration: 0.2 }, '<')
          .fromTo(
            ticketRef.current,
            { scale: 0.6, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
            '<0.1'
          )
          .to(
            nonNull(confettiRefs.current),
            {
              opacity: 1,
              x: (i: number) => Math.cos((i / 6) * Math.PI * 2) * 60,
              y: (i: number) => Math.sin((i / 6) * Math.PI * 2) * 60,
              duration: 0.5,
              stagger: 0.03,
            },
            '<'
          )
          .to(nonNull(confettiRefs.current), { opacity: 0, duration: 0.4 }, '>-0.1');

        // Beat 3 — WALLET: the ticket shrinks into the wallet badge
        tl.addLabel('wallet')
          .to(walletBadgeRef.current, { opacity: 1, scale: 1, duration: 0.3 })
          .to(ticketRef.current, { scale: 0.3, x: 90, y: 140, opacity: 0.4, duration: 0.6 }, '<')
          .to(walletBadgeRef.current, { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1 }, '>-0.1');

        // Beat 4 — SCAN: the scanner slides in and a scan-line sweeps the ticket
        tl.addLabel('scan')
          .to(scannerRef.current, { opacity: 1, x: 0, duration: 0.4 })
          .to(ticketRef.current, { scale: 0.85, x: 40, y: 0, opacity: 1, duration: 0.5 }, '<')
          .fromTo(
            scanLineRef.current,
            { opacity: 1, xPercent: -100 },
            { xPercent: 100, duration: 0.7, ease: 'power1.inOut' },
            '>-0.1'
          );

        // Beat 5 — VALIDATED: the ticket turns green and the checkmark bounces in
        tl.addLabel('validated')
          .to(scanLineRef.current, { opacity: 0, duration: 0.2 })
          .to(ticketRef.current, { backgroundColor: '#f0fdf4', borderColor: '#22c55e', duration: 0.4 }, '<')
          .fromTo(
            checkRef.current,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' },
            '<0.1'
          )
          .to(scannerBadgeRef.current, { boxShadow: '0 0 0 4px rgba(34,197,94,0.5)', duration: 0.3 }, '<');
      });

      mm.add('(max-width: 1023.98px)', () => {
        mobileCardRefs.current.forEach(card => {
          if (!card) return;
          gsap.from(card, {
            opacity: 0,
            y: 20,
            duration: 0.5,
            scrollTrigger: { trigger: card, start: 'top 85%', once: true },
          });
        });
      });
    },
    { scope: sectionRef, dependencies: [steps.length] }
  );

  return (
    <div ref={sectionRef} className="full-bleed relative bg-gray-900">
      {/* Desktop: pinned scroll-scrubbed stage */}
      <div className="mx-auto hidden h-screen max-w-7xl flex-col items-center justify-center px-4 sm:px-6 lg:flex lg:px-8">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">{eyebrow}</p>
        <h2 className="mb-12 max-w-2xl text-center text-2xl font-extrabold text-white sm:text-3xl">{headline}</h2>

        <div className="relative h-[440px] w-[300px]">
          {/* Phone shell */}
          <div className="absolute inset-0 rounded-[2.5rem] border-[6px] border-gray-700 bg-gray-800 shadow-2xl">
            <div className="relative m-2 h-[calc(100%-16px)] overflow-hidden rounded-[2rem] bg-white">
              <div
                ref={buyButtonRef}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-gray-900 px-5 py-2.5 text-xs font-semibold text-white"
              >
                {buyButtonLabel}
              </div>
              <div ref={sheetRef} className="absolute inset-x-0 bottom-0 h-[45%] rounded-t-2xl border-t border-gray-200 bg-gray-50 p-4">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />
                <div className="h-2.5 w-2/3 rounded bg-gray-200" />
                <div className="mt-2 h-2.5 w-1/2 rounded bg-gray-200" />
                <div className="mt-4 h-8 rounded-lg bg-gray-900" />
              </div>
            </div>
          </div>

          {/* Tap indicator */}
          <div ref={tapRef} className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 text-gray-900">
            <MousePointerClick className="h-6 w-6" />
          </div>

          {/* Ticket card */}
          <div
            ref={ticketRef}
            className="ticket-shape absolute left-1/2 top-1/2 w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="h-2 w-16 rounded bg-gray-300" />
              <CircleCheckBig className="h-4 w-4 text-gray-300" />
            </div>
            <div className="my-3 border-t border-dashed border-gray-300" />
            <div className="h-2 w-24 rounded bg-gray-200" />
            <div className="mt-1.5 h-2 w-16 rounded bg-gray-200" />
          </div>

          {/* Confetti */}
          {CONFETTI_COLORS.map((color, i) => (
            <span
              key={color + i}
              ref={el => {
                confettiRefs.current[i] = el;
              }}
              className={`absolute left-1/2 top-1/2 h-2 w-2 rounded-full ${color}`}
            />
          ))}

          {/* Wallet badge */}
          <div
            ref={walletBadgeRef}
            className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-gray-700 ring-4 ring-gray-900"
          >
            <Wallet className="h-5 w-5 text-white" />
          </div>

          {/* Scanner kiosk */}
          <div ref={scannerRef} className="absolute -right-16 top-1/3 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-2xl bg-gray-800 ring-1 ring-white/10">
            <span ref={scannerBadgeRef} className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-600">
              <QrCode className="h-5 w-5 text-white" />
            </span>
          </div>

          {/* Scan line */}
          <div
            ref={scanLineRef}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-0.5 -translate-x-1/2 -translate-y-1/2 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)]"
          />

          {/* Checkmark */}
          <div
            ref={checkRef}
            className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-green-600"
          >
            <CircleCheckBig className="h-9 w-9 text-white" />
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2">
          {steps.map((step, i) => (
            <span
              key={step.id}
              ref={el => {
                dotRefs.current[i] = el;
              }}
              className="h-1.5 w-1.5 rounded-full bg-white/30 transition-colors"
            />
          ))}
        </div>

        <div className="relative mt-4 h-5 w-full max-w-xs">
          {steps.map((step, i) => (
            <p
              key={step.id}
              ref={el => {
                captionRefs.current[i] = el;
              }}
              className="absolute inset-x-0 text-center text-sm font-medium text-gray-300"
            >
              {step.caption}
            </p>
          ))}
        </div>
      </div>

      {/* Mobile: stacked reveal, no pin/scrub */}
      <div className="px-4 py-16 sm:px-6 lg:hidden">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">{eyebrow}</p>
        <h2 className="mb-10 text-center text-2xl font-extrabold text-white">{headline}</h2>
        <div className="mx-auto max-w-md space-y-4">
          {steps.map((step, i) => (
            <div
              key={step.id}
              ref={el => {
                mobileCardRefs.current[i] = el;
              }}
              className="flex items-center gap-4 rounded-2xl bg-gray-800 p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-700 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <p className="mt-0.5 text-sm text-gray-400">{step.caption}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
