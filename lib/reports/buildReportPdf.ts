import {PDFDocument, StandardFonts} from 'pdf-lib';
import {PdfCursor, TableColumn} from './pdfTable';
import {ReportData, ReportSection} from './types';

function money(amount: number, currency: string | null): string {
  return currency ? `${amount.toFixed(2)} ${currency}` : amount.toFixed(2);
}

function dateTime(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'});
}

export async function buildReportPdf(data: ReportData, sections: ReportSection[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cursor = PdfCursor.create(doc, regular, bold);

  cursor.drawHeading(data.event.title);
  cursor.drawMeta(
    `${new Date(data.event.date).toLocaleDateString('en-US', {dateStyle: 'long'})} · ${data.event.venue.name}, ${data.event.venue.city}`,
  );
  cursor.drawMeta(`Report generated ${new Date().toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})}`);

  if (sections.includes('sales')) {
    cursor.drawSectionTitle('Sales by tier');
    const columns: TableColumn[] = [
      {label: 'TIER', width: 140},
      {label: 'PRICE', width: 90},
      {label: 'SOLD / QTY', width: 90},
      {label: 'REVENUE', width: 100},
    ];
    const rows = data.sales.map(t => [
      t.name,
      money(t.price, t.currency),
      `${t.quantitySold} / ${t.quantity}`,
      money(t.revenue, t.currency),
    ]);
    cursor.drawTable(columns, rows, 'No ticket tiers.');
  }

  if (sections.includes('attendees')) {
    cursor.drawSectionTitle('Attendees');
    const columns: TableColumn[] = [
      {label: 'NAME', width: 110},
      {label: 'EMAIL', width: 130},
      {label: 'TIER', width: 80},
      {label: 'STATUS', width: 70},
      {label: 'SEAT', width: 60},
    ];
    const rows = data.attendees.map(a => [
      a.buyerName,
      a.buyerEmail ?? '—',
      a.tierName,
      a.status,
      a.seatLabel ?? '—',
    ]);
    cursor.drawTable(columns, rows, 'No attendees yet.');
  }

  if (sections.includes('finance')) {
    cursor.drawSectionTitle('Finance summary');
    const columns: TableColumn[] = [
      {label: 'METRIC', width: 220},
      {label: 'VALUE', width: 220},
    ];
    const f = data.finance;
    const rows = [
      ['Total revenue (confirmed)', money(f.totalRevenue, f.currency)],
      ['Pending revenue', money(f.pendingRevenue, f.currency)],
      ['Platform fee', f.platformFeeTotal != null ? money(f.platformFeeTotal, f.platformFeeCurrency) : '—'],
      ['Venue layout fee', f.venueLayoutFeeTotal != null ? money(f.venueLayoutFeeTotal, f.venueLayoutFeeCurrency) : '—'],
      ['Online payments', String(f.paymentMethodCounts.online ?? 0)],
      ['Manual (bank transfer) payments', String(f.paymentMethodCounts.manual ?? 0)],
      ['Cash payments', String(f.paymentMethodCounts.cash ?? 0)],
    ];
    cursor.drawTable(columns, rows, 'No finance data.');
  }

  if (sections.includes('payments')) {
    cursor.drawSectionTitle('Payment approvals');
    const columns: TableColumn[] = [
      {label: 'BUYER', width: 100},
      {label: 'AMOUNT', width: 80},
      {label: 'METHOD', width: 60},
      {label: 'STATUS', width: 70},
      {label: 'ACTIONED BY', width: 90},
      {label: 'WHEN', width: 90},
    ];
    const rows = data.paymentApprovals.map(p => [
      p.buyerName,
      money(p.amount, p.currency),
      p.method,
      p.status,
      p.actionedByName ?? '—',
      dateTime(p.actionedAt),
    ]);
    cursor.drawTable(columns, rows, 'No payments yet.');
  }

  if (sections.includes('checkins')) {
    cursor.drawSectionTitle('Check-ins');
    const columns: TableColumn[] = [
      {label: 'TICKET #', width: 100},
      {label: 'ATTENDEE', width: 130},
      {label: 'SCANNED BY', width: 110},
      {label: 'SCANNED AT', width: 110},
    ];
    const rows = data.checkIns.map(c => [
      c.ticketNumber ?? '—',
      c.buyerName,
      c.scannedByName ?? '—',
      dateTime(c.scannedAt),
    ]);
    cursor.drawTable(columns, rows, 'No check-ins yet.');
  }

  return doc.save();
}
