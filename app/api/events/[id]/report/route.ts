import {fetchQuery} from 'convex/nextjs';
import {convexAuthNextjsToken} from '@convex-dev/auth/nextjs/server';
import {api} from '@/convex/_generated/api';
import {Id} from '@/convex/_generated/dataModel';
import {buildReportPdf} from '@/lib/reports/buildReportPdf';
import {buildReportExcel} from '@/lib/reports/buildReportExcel';
import {parseSections} from '@/lib/reports/types';

export const dynamic = 'force-dynamic';

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'event';
}

export async function GET(request: Request, {params}: {params: {id: string}}) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return new Response('Unauthorized', {status: 401});
  }

  const data = await fetchQuery(
    api.eventReports.getReportData,
    {eventId: params.id as Id<'events'>},
    {token},
  );

  if (!data) {
    return new Response('Forbidden', {status: 403});
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'excel' ? 'excel' : 'pdf';
  const sections = parseSections(url.searchParams.get('sections'));
  const filenameBase = `event-report-${slugify(data.event.title)}`;

  if (format === 'excel') {
    const buffer = await buildReportExcel(data, sections);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const pdfBytes = await buildReportPdf(data, sections);
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
