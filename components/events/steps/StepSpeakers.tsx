'use client';

import {useRef} from 'react';
import {useTranslations} from 'next-intl';
import Image from 'next/image';
import {EventFormData, FormSpeaker} from '@/types/eventForm';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';

type Props = {
  data: EventFormData;
  onChange: (patch: Partial<EventFormData>) => void;
};

function SpeakerCard({
  speaker,
  index,
  onUpdate,
  onRemove,
}: {
  speaker: FormSpeaker;
  index: number;
  onUpdate: (patch: Partial<FormSpeaker>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('eventCreate.speakers');
  const photoRef = useRef<HTMLInputElement>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    onUpdate({
      photoFile: file,
      photoPreviewUrl: URL.createObjectURL(file),
      photoStorageId: null,
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          {t('speakerNumber', {n: index + 1})}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
        >
          {t('removeButton')}
        </button>
      </div>

      <div className="space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          {speaker.photoPreviewUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-gray-200">
              <Image src={speaker.photoPreviewUrl} alt="" fill className="object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-xl text-gray-300">
              👤
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('photoButton')}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhoto}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('nameLabel')} required>
            <Input
              type="text"
              value={speaker.name}
              onChange={e => onUpdate({name: e.target.value})}
              placeholder={t('namePlaceholder')}
            />
          </FormField>
          <FormField label={t('titleLabel')}>
            <Input
              type="text"
              value={speaker.speakerTitle}
              onChange={e => onUpdate({speakerTitle: e.target.value})}
              placeholder={t('titlePlaceholder')}
            />
          </FormField>
        </div>

        <FormField label={t('bioLabel')}>
          <Textarea
            value={speaker.bio}
            onChange={e => onUpdate({bio: e.target.value})}
            placeholder={t('bioPlaceholder')}
            rows={3}
          />
        </FormField>
      </div>
    </div>
  );
}

export default function StepSpeakers({data, onChange}: Props) {
  const t = useTranslations('eventCreate');

  function addSpeaker() {
    const newSpeaker: FormSpeaker = {
      tempId: crypto.randomUUID(),
      name: '',
      speakerTitle: '',
      bio: '',
      photoFile: null,
      photoPreviewUrl: null,
      photoStorageId: null,
    };
    onChange({speakers: [...data.speakers, newSpeaker]});
  }

  function updateSpeaker(tempId: string, patch: Partial<FormSpeaker>) {
    onChange({
      speakers: data.speakers.map(s =>
        s.tempId === tempId ? {...s, ...patch} : s,
      ),
    });
  }

  function removeSpeaker(tempId: string) {
    onChange({speakers: data.speakers.filter(s => s.tempId !== tempId)});
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('speakers.heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('speakers.subheading')}</p>
      </div>

      {data.speakers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          {t('speakers.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {data.speakers.map((speaker, i) => (
            <SpeakerCard
              key={speaker.tempId}
              speaker={speaker}
              index={i}
              onUpdate={patch => updateSpeaker(speaker.tempId, patch)}
              onRemove={() => removeSpeaker(speaker.tempId)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addSpeaker}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
      >
        <span>+</span>
        {t('speakers.addButton')}
      </button>
    </div>
  );
}
