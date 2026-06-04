import { jsPDF } from 'jspdf';
import type { PrintSection } from './print';

/**
 * Generate and download a real .pdf file from structured sections, using jsPDF.
 * Text-based (selectable, small file size), with word-wrap and automatic
 * pagination. Shares the {@link PrintSection} shape with the browser-print path.
 */
export function downloadPdf(
  filename: string,
  title: string,
  subtitle: string,
  sections: PrintSection[],
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (needed: number): void => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (text: string, size: number, opts: { bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number } = {}): void => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [17, 17, 17]));
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(text, maxW - indent) as string[];
    const lineH = size * 1.35;
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, margin + indent, y);
      y += lineH;
    }
    y += opts.gap ?? 0;
  };

  // Title + subtitle
  writeLines(title, 20, { bold: true, gap: 2 });
  if (subtitle) writeLines(subtitle, 10.5, { color: [110, 110, 110], gap: 10 });

  for (const s of sections) {
    const hasContent = (s.paragraphs?.length || s.bullets?.length || s.rows?.length);
    if (s.heading && hasContent) {
      ensure(26);
      y += 6;
      writeLines(s.heading.toUpperCase(), 10, { bold: true, color: [70, 70, 70], gap: 4 });
      doc.setDrawColor(220);
      doc.line(margin, y - 6, pageW - margin, y - 6);
    }
    for (const p of s.paragraphs ?? []) writeLines(p, 11, { gap: 4 });
    for (const r of s.rows ?? []) writeLines(`${r.label}:  ${r.value}`, 10.5, { gap: 2 });
    for (const b of s.bullets ?? []) writeLines(`•  ${b}`, 10.5, { gap: 2, indent: 4 });
    if (hasContent) y += 6;
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
