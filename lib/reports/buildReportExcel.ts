import ExcelJS from 'exceljs';
import {ReportData, ReportSection} from './types';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: {argb: 'FFF3F4F6'},
};

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: {header: string; key: string; width: number}[],
  rows: Record<string, string | number | null>[],
) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.getRow(1).eachCell(cell => {
    cell.font = {bold: true};
    cell.fill = HEADER_FILL;
  });
  for (const row of rows) sheet.addRow(row);
}

export async function buildReportExcel(data: ReportData, sections: ReportSection[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TickOck';
  workbook.created = new Date();

  if (sections.includes('sales')) {
    addSheet(
      workbook,
      'Sales',
      [
        {header: 'Tier', key: 'name', width: 24},
        {header: 'Price', key: 'price', width: 12},
        {header: 'Currency', key: 'currency', width: 10},
        {header: 'Sold', key: 'sold', width: 10},
        {header: 'Quantity', key: 'quantity', width: 10},
        {header: 'Revenue', key: 'revenue', width: 14},
      ],
      data.sales.map(t => ({
        name: t.name,
        price: t.price,
        currency: t.currency,
        sold: t.quantitySold,
        quantity: t.quantity,
        revenue: t.revenue,
      })),
    );
  }

  if (sections.includes('attendees')) {
    addSheet(
      workbook,
      'Attendees',
      [
        {header: 'Name', key: 'name', width: 24},
        {header: 'Email', key: 'email', width: 28},
        {header: 'Tier', key: 'tier', width: 18},
        {header: 'Status', key: 'status', width: 16},
        {header: 'Seat', key: 'seat', width: 12},
        {header: 'Ticket #', key: 'ticketNumber', width: 16},
        {header: 'Ordered', key: 'ordered', width: 20},
      ],
      data.attendees.map(a => ({
        name: a.buyerName,
        email: a.buyerEmail,
        tier: a.tierName,
        status: a.status,
        seat: a.seatLabel,
        ticketNumber: a.ticketNumber,
        ordered: new Date(a.createdAt).toLocaleString(),
      })),
    );
  }

  if (sections.includes('finance')) {
    const f = data.finance;
    addSheet(
      workbook,
      'Finance',
      [
        {header: 'Metric', key: 'metric', width: 32},
        {header: 'Value', key: 'value', width: 20},
      ],
      [
        {metric: 'Total revenue (confirmed)', value: f.totalRevenue},
        {metric: 'Pending revenue', value: f.pendingRevenue},
        {metric: 'Currency', value: f.currency},
        {metric: 'Platform fee', value: f.platformFeeTotal},
        {metric: 'Venue layout fee', value: f.venueLayoutFeeTotal},
        {metric: 'Online payments', value: f.paymentMethodCounts.online ?? 0},
        {metric: 'Manual payments', value: f.paymentMethodCounts.manual ?? 0},
        {metric: 'Cash payments', value: f.paymentMethodCounts.cash ?? 0},
      ],
    );
  }

  if (sections.includes('payments')) {
    addSheet(
      workbook,
      'Payment Approvals',
      [
        {header: 'Buyer', key: 'buyer', width: 24},
        {header: 'Amount', key: 'amount', width: 12},
        {header: 'Currency', key: 'currency', width: 10},
        {header: 'Method', key: 'method', width: 12},
        {header: 'Status', key: 'status', width: 12},
        {header: 'Actioned by', key: 'actionedBy', width: 24},
        {header: 'Actioned at', key: 'actionedAt', width: 20},
        {header: 'Rejection reason', key: 'reason', width: 28},
      ],
      data.paymentApprovals.map(p => ({
        buyer: p.buyerName,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        status: p.status,
        actionedBy: p.actionedByName,
        actionedAt: p.actionedAt ? new Date(p.actionedAt).toLocaleString() : null,
        reason: p.rejectionReason,
      })),
    );
  }

  if (sections.includes('checkins')) {
    addSheet(
      workbook,
      'Check-ins',
      [
        {header: 'Ticket #', key: 'ticketNumber', width: 16},
        {header: 'Attendee', key: 'attendee', width: 24},
        {header: 'Scanned by', key: 'scannedBy', width: 24},
        {header: 'Scanned at', key: 'scannedAt', width: 20},
      ],
      data.checkIns.map(c => ({
        ticketNumber: c.ticketNumber,
        attendee: c.buyerName,
        scannedBy: c.scannedByName,
        scannedAt: c.scannedAt ? new Date(c.scannedAt).toLocaleString() : null,
      })),
    );
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
