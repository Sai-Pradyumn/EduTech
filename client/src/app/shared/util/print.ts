/**
 * Dependency-free "Save as PDF / Print" helper.
 *
 * Opens the supplied HTML body in a hidden, sandboxed iframe with a clean
 * print stylesheet and triggers the browser print dialog — from which the user
 * can "Save as PDF". No third-party library, no popup window (avoids blockers).
 */
export interface PrintSection {
  heading?: string;
  /** Paragraph lines (rendered as <p>). */
  paragraphs?: string[];
  /** Bullet list items. */
  bullets?: string[];
  /** key → value rows (rendered as a definition-style grid). */
  rows?: { label: string; value: string }[];
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function renderSection(s: PrintSection): string {
  const parts: string[] = [];
  if (s.heading) parts.push(`<h2>${esc(s.heading)}</h2>`);
  for (const p of s.paragraphs ?? []) parts.push(`<p>${esc(p)}</p>`);
  if (s.rows?.length) {
    parts.push(
      `<dl>${s.rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('')}</dl>`,
    );
  }
  if (s.bullets?.length) {
    parts.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
  }
  return `<section>${parts.join('')}</section>`;
}

/**
 * Print a structured document. `title` is the heading + the suggested PDF
 * filename (the browser derives it from document.title).
 */
export function printDocument(title: string, subtitle: string, sections: PrintSection[]): void {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; line-height: 1.5; }
      .wrap { max-width: 720px; margin: 0 auto; padding: 40px 36px; }
      h1 { font-size: 24px; margin: 0 0 2px; }
      .sub { color: #555; font-size: 13px; margin: 0 0 20px; }
      section { margin-bottom: 18px; }
      h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 0 0 8px; }
      p { margin: 0 0 6px; font-size: 13.5px; }
      ul { margin: 0; padding-left: 18px; }
      li { font-size: 13.5px; margin-bottom: 3px; }
      dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; }
      dl div { display: contents; }
      dt { font-weight: 600; font-size: 13px; }
      dd { margin: 0; font-size: 13px; }
      @media print { .wrap { padding: 0; } @page { margin: 18mm; } }
    </style></head>
    <body><div class="wrap"><h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
      ${sections.map(renderSection).join('')}
    </div></body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.focus();
    win.print();
    // Remove after the print dialog is dismissed.
    win.onafterprint = cleanup;
    setTimeout(cleanup, 60_000); // safety net if onafterprint never fires
  };

  const doc = iframe.contentWindow?.document ?? iframe.contentDocument;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
}
