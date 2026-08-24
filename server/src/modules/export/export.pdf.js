// server/src/modules/export/export.pdf.js
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocumentModel, formatDuration } from './export.model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = path.join(here, 'be-vietnam-pro-regular.ttf');
const FONT_BOLD = path.join(here, 'be-vietnam-pro-bold.ttf');

const BRAND = '#00657a';
const INK = '#1b1b1b';
const MUTED = '#6f797d';

// Only characters already proven to render through the embedded Vietnamese
// font: "•" (General Punctuation — the original renderer already used it
// successfully) and plain ASCII. Symbol/dingbat glyphs like ✓ ☐ ☑ ● are NOT
// guaranteed present in a Latin+Vietnamese webfont and risk a missing-glyph
// box — not worth the visual risk for a checkbox look.
function toPdf(summary, meta = {}) {
  const doc = buildDocumentModel(summary, meta);

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    // Đăng ký font TRƯỚC bất kỳ .text() nào — quên bước này là mất dấu tiếng Việt.
    pdf.registerFont('body', FONT_REGULAR);
    pdf.registerFont('bold', FONT_BOLD);

    const pageWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;

    pdf.font('bold').fontSize(22).fillColor(BRAND).text(doc.title);
    const duration = formatDuration(doc.durationSeconds);
    const metaBits = [doc.date, duration, doc.speakers.length ? `${doc.speakers.length} speakers` : null]
      .filter(Boolean)
      .join('   ·   ');
    pdf.font('body').fontSize(10).fillColor(MUTED).text(metaBits).moveDown(0.5);

    const ruleY = pdf.y;
    pdf.moveTo(pdf.page.margins.left, ruleY).lineTo(pdf.page.margins.left + pageWidth, ruleY).lineWidth(1.5).strokeColor(BRAND).stroke();
    pdf.moveDown(1);

    pdf.font('bold').fontSize(14).fillColor(BRAND).text('Executive Summary').moveDown(0.25);
    pdf.font('body').fontSize(11).fillColor(INK).text(doc.overview || 'No overview available.').moveDown();

    if (doc.speakers.length) {
      pdf.font('bold').fontSize(13).fillColor(BRAND).text('Speakers').moveDown(0.15);
      for (const s of doc.speakers) {
        pdf.font('body').fontSize(10.5).fillColor(s.color || MUTED).text('• ', { continued: true });
        pdf.fillColor(INK).text(`${s.label}${s.evidence ? ` — ${s.evidence}` : ''}`);
      }
      pdf.moveDown();
    }

    for (const section of doc.sections) {
      if (!section.items.length) continue;
      pdf.font('bold').fontSize(13).fillColor(section.color || BRAND).text(section.label).moveDown(0.15);
      for (const item of section.items) {
        const who = item.speakerLabel ? `  — ${item.speakerLabel}` : '';
        pdf.font('body').fontSize(10.5).fillColor(section.color || MUTED).text('• ', { continued: true });
        pdf.fillColor(INK).text(`${item.content}${who}`);
      }
      pdf.moveDown();
    }

    if (doc.actionItems.length) {
      pdf.font('bold').fontSize(13).fillColor(BRAND)
        .text(`Action Items (${doc.actionItemsDone}/${doc.actionItems.length} completed)`)
        .moveDown(0.2);
      for (const a of doc.actionItems) {
        const box = a.isDone ? '[x]' : '[ ]';
        pdf.font('body').fontSize(10.5).fillColor(INK).text(`${box}  ${a.content}`);
        const metaLine = [a.ownerLabel ?? 'Unassigned', a.dueDate ? `Due ${a.dueDate}` : null].filter(Boolean).join('   ·   ');
        pdf.font('body').fontSize(9).fillColor(MUTED).text(`     ${metaLine}`).moveDown(0.35);
      }
    }

    if (doc.transcript) {
      pdf.addPage();
      pdf.font('bold').fontSize(16).fillColor(BRAND).text('Full Transcript').moveDown(0.5);

      const speakerColor = (label) => doc.speakers.find((s) => s.label === label)?.color ?? MUTED;

      if (doc.transcript.kind === 'segments') {
        for (const seg of doc.transcript.segments) {
          if (seg.startMs != null || seg.speakerLabel) {
            const ts = seg.startMs != null ? `[${formatDuration(seg.startMs / 1000)}]  ` : '';
            pdf.font('body').fontSize(9).fillColor(MUTED).text(ts, { continued: !!seg.speakerLabel });
            if (seg.speakerLabel) pdf.font('bold').fontSize(9).fillColor(speakerColor(seg.speakerLabel)).text(seg.speakerLabel);
          }
          pdf.font('body').fontSize(10.5).fillColor(INK).text(seg.text).moveDown(0.4);
        }
      } else {
        pdf.font('body').fontSize(10.5).fillColor(INK).text(doc.transcript.text, { paragraphGap: 8 });
      }
    }

    pdf.end();
  });
}

export { toPdf };
