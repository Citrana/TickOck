'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Id} from '@/convex/_generated/dataModel';
import ColumnsPicker from '@/components/ui/ColumnsPicker';
import {REPORT_SECTIONS, ReportSection} from '@/lib/reports/types';

type Props = {eventId: Id<'events'>};

export default function ReportsPanel({eventId}: Props) {
  const t = useTranslations('manage.reports');

  const [sections, setSections] = useState<string[]>([...REPORT_SECTIONS]);

  const sectionOptions = REPORT_SECTIONS.map(key => ({key, label: t(`sections.${key}`)}));

  function downloadUrl(format: 'pdf' | 'excel'): string {
    const params = new URLSearchParams({format, sections: sections.join(',')});
    return `/api/events/${eventId}/report?${params.toString()}`;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('heading')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('subheading')}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700">{t('sectionsLabel')}</p>
          <ColumnsPicker
            all={sectionOptions}
            visible={sections}
            onChange={setSections}
            buttonLabel={t('sectionsPickerButton')}
          />
        </div>

        <ul className="mt-3 flex flex-wrap gap-2">
          {sectionOptions
            .filter(opt => sections.includes(opt.key as ReportSection))
            .map(opt => (
              <li
                key={opt.key}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {opt.label}
              </li>
            ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-5">
          <a
            href={downloadUrl('pdf')}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            {t('downloadPdf')}
          </a>
          <a
            href={downloadUrl('excel')}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('downloadExcel')}
          </a>
        </div>
      </div>
    </div>
  );
}
