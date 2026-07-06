import { jsPDF } from 'jspdf';
import { SECTIONS, SYNTHESIS_FIELDS, sectionLabel } from './schema.js';

// Build a structured, multi-page PDF from a tab's analysis data. Generated from
// the data (not the DOM), so every domain is included regardless of which
// accordions are open.
export function exportAnalysisPdf(mode, query, analysis, synthesis) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const M = 48; // margin
  const CONTENT_W = PAGE_W - M * 2;
  const BOTTOM = PAGE_H - 56;

  const ACCENT = [79, 124, 255];
  const TEXT = [30, 37, 54];
  const MUTED = [92, 107, 138];

  let y = 60;

  const ensure = (space) => {
    if (y + space > BOTTOM) {
      doc.addPage();
      y = 60;
    }
  };

  const write = (text, { size = 10, style = 'normal', color = TEXT, x = M, gap = 4, lineH = 1.35 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(text), CONTENT_W - (x - M));
    const lh = size * lineH;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, x, y);
      y += lh;
    }
    y += gap;
  };

  const rule = () => {
    ensure(12);
    doc.setDrawColor(226, 232, 242);
    doc.line(M, y, PAGE_W - M, y);
    y += 14;
  };

  // ── Header ──
  write(`STRATEGIC ANALYZER · ${mode === 'sector' ? 'SECTOR' : 'COMPANY'}`, {
    size: 8,
    style: 'bold',
    color: ACCENT,
    gap: 2,
  });
  write(query, { size: 22, style: 'bold', gap: 2 });
  write(`Generated ${new Date().toLocaleDateString()}`, { size: 9, color: MUTED, gap: 8 });
  rule();

  // ── Synthesis ──
  if (synthesis) {
    write('Strategic Synthesis', { size: 14, style: 'bold', gap: 6 });
    if (synthesis.executiveSummary) {
      write(synthesis.executiveSummary, { size: 10, gap: 8 });
    }
    for (const f of SYNTHESIS_FIELDS) {
      const items = synthesis[f.key];
      if (Array.isArray(items) && items.length) {
        write(f.label, { size: 10, style: 'bold', color: MUTED, gap: 3 });
        for (const item of items) {
          if (item) write(`•  ${item}`, { size: 10, x: M + 10, gap: 3 });
        }
        y += 4;
      }
    }
    rule();
  }

  // ── Domains ──
  for (const section of SECTIONS) {
    const data = analysis?.[section.key];
    if (!data) continue;
    const hasAny = section.fields.some((f) => data[f.key]);
    if (!hasAny) continue;

    ensure(40);
    write(sectionLabel(section, mode), { size: 13, style: 'bold', color: ACCENT, gap: 6 });

    for (const field of section.fields) {
      const value = data[field.key];
      if (!value) continue;
      write(field.label.toUpperCase(), { size: 8, style: 'bold', color: MUTED, gap: 2 });
      write(value, { size: 10, gap: 8 });
    }
    y += 4;
  }

  // ── Page footer numbers ──
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 28, { align: 'right' });
    doc.text('Strategic Analyzer', M, PAGE_H - 28);
  }

  const safe = query.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  doc.save(`${safe || 'analysis'}-${mode}.pdf`);
}
