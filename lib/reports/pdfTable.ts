import {PDFDocument, PDFFont, PDFPage, rgb} from 'pdf-lib';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const ROW_HEIGHT = 18;

const HEADER_BG = rgb(0.95, 0.95, 0.95);
const TEXT_COLOR = rgb(0.15, 0.15, 0.15);
const MUTED_COLOR = rgb(0.6, 0.6, 0.6);
const HEADING_COLOR = rgb(0.08, 0.08, 0.08);
const BORDER_COLOR = rgb(0.85, 0.85, 0.85);

export type TableColumn = {label: string; width: number};

function truncate(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

// Tracks the current page/y-position across a report that draws multiple
// tables one after another, adding pages as content overflows — pdf-lib
// pages are fixed-size and immutable in position, so all pagination state
// has to be tracked externally like this.
export class PdfCursor {
  private constructor(
    public doc: PDFDocument,
    public page: PDFPage,
    public y: number,
    private regular: PDFFont,
    private bold: PDFFont,
  ) {}

  static create(doc: PDFDocument, regular: PDFFont, bold: PDFFont): PdfCursor {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return new PdfCursor(doc, page, PAGE_HEIGHT - MARGIN, regular, bold);
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  drawHeading(text: string) {
    this.ensureSpace(30);
    this.page.drawText(text, {x: MARGIN, y: this.y, size: 22, font: this.bold, color: HEADING_COLOR});
    this.y -= 30;
  }

  drawMeta(text: string) {
    this.ensureSpace(18);
    this.page.drawText(text, {x: MARGIN, y: this.y, size: 10, font: this.regular, color: MUTED_COLOR});
    this.y -= 18;
  }

  drawSectionTitle(text: string) {
    this.ensureSpace(28);
    this.page.drawText(text, {x: MARGIN, y: this.y, size: 13, font: this.bold, color: HEADING_COLOR});
    this.y -= 22;
  }

  drawTable(columns: TableColumn[], rows: string[][], emptyLabel: string) {
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

    const drawHeaderRow = () => {
      this.ensureSpace(ROW_HEIGHT * 2);
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - ROW_HEIGHT + 4,
        width: tableWidth,
        height: ROW_HEIGHT,
        color: HEADER_BG,
      });
      let x = MARGIN;
      for (const col of columns) {
        this.page.drawText(col.label, {x: x + 4, y: this.y - ROW_HEIGHT + 9, size: 8, font: this.bold, color: TEXT_COLOR});
        x += col.width;
      }
      this.y -= ROW_HEIGHT;
    };

    drawHeaderRow();

    if (rows.length === 0) {
      this.page.drawText(emptyLabel, {x: MARGIN + 4, y: this.y - ROW_HEIGHT + 9, size: 9, font: this.regular, color: MUTED_COLOR});
      this.y -= ROW_HEIGHT + 16;
      return;
    }

    for (const row of rows) {
      if (this.y - ROW_HEIGHT < MARGIN) {
        this.newPage();
        drawHeaderRow();
      }

      let x = MARGIN;
      for (let i = 0; i < columns.length; i++) {
        const value = truncate(this.regular, row[i] ?? '', 9, columns[i].width - 8);
        this.page.drawText(value, {x: x + 4, y: this.y - ROW_HEIGHT + 9, size: 9, font: this.regular, color: TEXT_COLOR});
        x += columns[i].width;
      }
      this.page.drawLine({
        start: {x: MARGIN, y: this.y - ROW_HEIGHT},
        end: {x: MARGIN + tableWidth, y: this.y - ROW_HEIGHT},
        thickness: 0.5,
        color: BORDER_COLOR,
      });
      this.y -= ROW_HEIGHT;
    }
    this.y -= 16;
  }
}
