'use client';

import {useState, useCallback, useEffect, useRef} from 'react';
import {useRouter} from '@/lib/navigation';
import {useTranslations} from 'next-intl';
import {useMutation, useQuery} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {
  EventFormData,
  EMPTY_FORM,
  FormTier,
  FormSpeaker,
} from '@/types/eventForm';
import {calculatePlatformFee} from '@/lib/platformFee';
import FormStepNav from './FormStepNav';
import StepBasicInfo from './steps/StepBasicInfo';
import StepVenue from './steps/StepVenue';
import StepSettings from './steps/StepSettings';
import StepSpeakers from './steps/StepSpeakers';
import StepTickets from './steps/StepTickets';
import StepReview from './steps/StepReview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  /** When provided, the form loads this event and operates in edit mode. */
  existingEventId?: Id<'events'>;
  locale: string;
};

type FormErrors = Partial<Record<keyof EventFormData, string>> & {
  tiers?: string;
  global?: string;
};

const STEPS = [
  'basicInfo',
  'venue',
  'settings',
  'speakers',
  'tickets',
  'review',
] as const;

// ---------------------------------------------------------------------------
// Validation per step
// ---------------------------------------------------------------------------

function validateStep(step: number, data: EventFormData): FormErrors {
  const errors: FormErrors = {};

  if (step === 0) {
    if (!data.title.trim()) errors.title = 'required';
  }
  if (step === 1) {
    if (!data.venueName.trim()) errors.venueName = 'required';
    if (!data.venueAddress.trim()) errors.venueAddress = 'required';
    if (!data.venueCity.trim()) errors.venueCity = 'required';
    if (!data.date) errors.date = 'required';
    if (!data.startTime) errors.startTime = 'required';
  }
  if (step === 4) {
    if (data.tiers.length === 0) errors.tiers = 'required';
    else {
      for (const tier of data.tiers) {
        if (!tier.name.trim() || !tier.price || !tier.quantity) {
          errors.tiers = 'incomplete';
          break;
        }
      }
    }
  }

  return errors;
}

function validateForSubmission(data: EventFormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.title.trim()) errors.title = 'required';
  if (!data.venueName.trim()) errors.venueName = 'required';
  if (!data.date) errors.date = 'required';
  if (!data.startTime) errors.startTime = 'required';
  if (data.tiers.length === 0) errors.tiers = 'required';
  if (!data.paymentScreenshotFile && !data.paymentScreenshotStorageId) {
    errors.paymentScreenshotFile = 'required' as unknown as string;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// File upload helper
// ---------------------------------------------------------------------------

async function uploadFile(
  generateUrl: () => Promise<string>,
  file: File,
): Promise<Id<'_storage'>> {
  const uploadUrl = await generateUrl();
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {'Content-Type': file.type},
    body: file,
  });
  if (!res.ok) throw new Error('File upload failed');
  const {storageId} = (await res.json()) as {storageId: string};
  return storageId as Id<'_storage'>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateEventForm({existingEventId, locale}: Props) {
  const t = useTranslations('eventCreate');
  const router = useRouter();

  const generateUploadUrl = useMutation(api.events.generateUploadUrl);
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const submitForApproval = useMutation(api.events.submitForApproval);
  const pricingRules = useQuery(api.platformPricing.listActive);

  // Load existing event data when editing
  const existingEvent = useQuery(
    api.events.get,
    existingEventId ? {eventId: existingEventId} : 'skip',
  );

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedEventId, setSavedEventId] = useState<Id<'events'> | null>(
    existingEventId ?? null,
  );

  // ---------------------------------------------------------------------------
  // Initialise form from existing event or empty
  // ---------------------------------------------------------------------------

  const [data, setData] = useState<EventFormData>(EMPTY_FORM);
  // Guard so we only populate the form once — on the first time the query resolves.
  // useState's lazy initializer only runs on the first render, before the query
  // returns, so existingEvent is always undefined there.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!existingEvent || initializedRef.current) return;
    initializedRef.current = true;

    const tiers: FormTier[] = (existingEvent.tiers ?? []).map(tier => ({
      tempId: tier._id,
      existingId: tier._id,
      name: tier.name,
      price: String(tier.price),
      currency: tier.currency,
      quantity: String(tier.quantity),
      description: tier.description ?? '',
      priceLocked: tier.quantitySold > 0,
    }));

    const speakers: FormSpeaker[] = (existingEvent.speakers ?? []).map(s => ({
      tempId: s._id,
      existingId: s._id,
      name: s.name,
      speakerTitle: s.speakerTitle ?? '',
      bio: s.bio ?? '',
      photoFile: null,
      photoPreviewUrl: s.photoUrl ?? null,
      photoStorageId: s.photoStorageId ?? null,
    }));

    setData({
      title: existingEvent.title,
      description: existingEvent.description ?? '',
      category: existingEvent.category ?? '',
      venueName: existingEvent.venue.name,
      venueAddress: existingEvent.venue.address,
      venueCity: existingEvent.venue.city,
      date: new Date(existingEvent.date).toISOString().slice(0, 10),
      startTime: existingEvent.startTime,
      endTime: existingEvent.endTime ?? '',
      timezone: existingEvent.timezone,
      coverImageFile: null,
      coverImagePreviewUrl: existingEvent.coverImageUrl ?? null,
      coverImageStorageId: existingEvent.coverImageStorageId ?? null,
      visibility: existingEvent.visibility,
      paymentMode: existingEvent.paymentMode,
      cancellationAllowed: existingEvent.cancellationPolicy.allowed,
      cancellationCutoffHours: String(
        existingEvent.cancellationPolicy.cutoffHours ?? 24,
      ),
      speakers,
      tiers,
      paymentScreenshotFile: null,
      paymentScreenshotStorageId:
        existingEvent.platformFeeEvidenceStorageId ?? null,
    });
  }, [existingEvent]);

  const patch = useCallback((partial: Partial<EventFormData>) => {
    setData(prev => ({...prev, ...partial}));
    setErrors({});
  }, []);

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  function goNext() {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep(s => Math.max(s - 1, 0));
  }

  // ---------------------------------------------------------------------------
  // Upload all pending files and return updated form data with storage IDs
  // ---------------------------------------------------------------------------

  async function uploadPendingFiles(current: EventFormData): Promise<EventFormData> {
    let updated = {...current};

    if (current.coverImageFile && !current.coverImageStorageId) {
      const id = await uploadFile(generateUploadUrl, current.coverImageFile);
      updated = {...updated, coverImageStorageId: id};
    }

    const updatedSpeakers = await Promise.all(
      current.speakers.map(async s => {
        if (s.photoFile && !s.photoStorageId) {
          const id = await uploadFile(generateUploadUrl, s.photoFile);
          return {...s, photoStorageId: id};
        }
        return s;
      }),
    );
    updated = {...updated, speakers: updatedSpeakers};

    if (current.paymentScreenshotFile && !current.paymentScreenshotStorageId) {
      const id = await uploadFile(generateUploadUrl, current.paymentScreenshotFile);
      updated = {...updated, paymentScreenshotStorageId: id};
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Build mutation args from form data
  // ---------------------------------------------------------------------------

  function buildEventArgs(current: EventFormData) {
    const totalTickets = current.tiers.reduce((sum, tier) => {
      const qty = parseInt(tier.quantity, 10);
      return sum + (isNaN(qty) ? 0 : qty);
    }, 0);

    const feeResult =
      pricingRules && pricingRules.length > 0
        ? calculatePlatformFee(current.tiers, pricingRules)
        : null;
    const platformFeeTotal =
      feeResult && feeResult.totalFee > 0 ? feeResult.totalFee : undefined;

    return {
      title: current.title.trim(),
      description: current.description.trim() || undefined,
      category: current.category || undefined,
      venue: {
        name: current.venueName.trim(),
        address: current.venueAddress.trim(),
        city: current.venueCity.trim(),
      },
      date: current.date ? new Date(current.date).getTime() : Date.now(),
      startTime: current.startTime,
      endTime: current.endTime || undefined,
      timezone: current.timezone,
      coverImageStorageId: current.coverImageStorageId ?? undefined,
      visibility: current.visibility,
      paymentMode: current.paymentMode,
      cancellationPolicy: {
        allowed: current.cancellationAllowed,
        cutoffHours: current.cancellationAllowed
          ? parseInt(current.cancellationCutoffHours, 10) || 24
          : undefined,
      },
      tiers: current.tiers.map(tier => ({
        existingId: tier.existingId,
        name: tier.name,
        price: parseFloat(tier.price) || 0,
        currency: tier.currency,
        quantity: parseInt(tier.quantity, 10) || 0,
        description: tier.description || undefined,
      })),
      speakers: current.speakers.map((s, i) => ({
        existingId: s.existingId,
        name: s.name,
        speakerTitle: s.speakerTitle || undefined,
        bio: s.bio || undefined,
        photoStorageId: s.photoStorageId ?? undefined,
        displayOrder: i,
      })),
      platformFeeTotal,
      platformFeeCurrency: feeResult?.currency ?? undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Save as draft
  // ---------------------------------------------------------------------------

  async function handleSaveDraft() {
    if (!data.title.trim()) {
      setErrors({title: 'required'});
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadPendingFiles(data);
      setData(uploaded);
      const args = buildEventArgs(uploaded);

      let eventId: Id<'events'>;
      if (savedEventId) {
        await updateEvent({eventId: savedEventId, ...args});
        eventId = savedEventId;
      } else {
        eventId = await createEvent(args);
        setSavedEventId(eventId);
      }

      router.push(`/${locale}/events/${eventId}/edit`);
    } catch (err) {
      setErrors({global: err instanceof Error ? err.message : String(err)});
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Submit for approval
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    const validationErrors = validateForSubmission(data);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Jump to first step with an error
      if (validationErrors.title) setStep(0);
      else if (validationErrors.date) setStep(1);
      else if (validationErrors.tiers) setStep(4);
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = await uploadPendingFiles(data);
      setData(uploaded);
      const args = buildEventArgs(uploaded);

      let eventId = savedEventId;
      if (eventId) {
        await updateEvent({eventId, ...args});
      } else {
        eventId = await createEvent(args);
        setSavedEventId(eventId);
      }

      if (!uploaded.paymentScreenshotStorageId) {
        throw new Error('Payment screenshot is required');
      }

      await submitForApproval({
        eventId: eventId!,
        platformFeeEvidenceStorageId: uploaded.paymentScreenshotStorageId,
      });

      router.push(`/${locale}/events/${eventId}`);
    } catch (err) {
      setErrors({global: err instanceof Error ? err.message : String(err)});
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // In edit mode, wait for the existing event to load before showing the form
  // so the user doesn't see a blank form while data is in flight.
  if (existingEventId && existingEvent === undefined) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-gray-200" />
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="space-y-4">
            <div className="h-5 w-40 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  const steps = STEPS.map((key, i) => ({label: t(`steps.${key}`), index: i}));
  const isLastStep = step === STEPS.length - 1;

  const stepProps = {data, onChange: patch, errors};

  return (
    <div className="mx-auto max-w-2xl">
      <FormStepNav steps={steps} current={step} onGoTo={setStep} />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Step content */}
        {step === 0 && <StepBasicInfo {...stepProps} />}
        {step === 1 && <StepVenue {...stepProps} />}
        {step === 2 && <StepSettings {...stepProps} />}
        {step === 3 && <StepSpeakers data={data} onChange={patch} />}
        {step === 4 && <StepTickets {...stepProps} />}
        {step === 5 && (
          <StepReview {...stepProps} existingEventId={savedEventId ?? undefined} />
        )}

        {/* Global error */}
        {errors.global && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.global}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t('nav.back')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {submitting ? t('nav.saving') : t('nav.saveAsDraft')}
            </button>

            {!isLastStep ? (
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="btn-ticket rounded-lg bg-gray-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                {t('nav.next')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-ticket rounded-lg bg-gray-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                {submitting ? t('nav.submitting') : t('nav.submitForApproval')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
