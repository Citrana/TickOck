import {fetchQuery} from 'convex/nextjs';
import {api} from '@/convex/_generated/api';

export const REPORT_SECTIONS = ['sales', 'attendees', 'finance', 'payments', 'checkins'] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export function parseSections(param: string | null): ReportSection[] {
  if (!param) return [...REPORT_SECTIONS];
  const requested = param.split(',').map(s => s.trim());
  const valid = requested.filter((s): s is ReportSection => (REPORT_SECTIONS as readonly string[]).includes(s));
  return valid.length > 0 ? valid : [...REPORT_SECTIONS];
}

export type ReportData = NonNullable<
  Awaited<ReturnType<typeof fetchQuery<typeof api.eventReports.getReportData>>>
>;
