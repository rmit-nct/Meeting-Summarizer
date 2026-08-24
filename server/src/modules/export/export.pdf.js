// server/src/modules/export/export.pdf.js
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocumentModel, formatDuration } from './export.model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = path.join(here, 'be-vietnam-pro-regular.ttf');
const FONT_BOLD = path.join(here, 'be-vietnam-pro-bold.ttf');

export function toPdf(summary, meta = {}) {
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

    pdf.font('bold').fontSize(20).text(doc.title);
    const duration = formatDuration(doc.durationSeconds);
    pdf
      .font('body')
      .fontSize(10)
      .text(duration ? `${doc.date}  ·  ${duration}` : doc.date)
      .moveDown();

    pdf.font('bold').fontSize(14).text('Overview').moveDown(0.25);
    pdf.font('body').fontSize(11).text(doc.overview || 'No overview available.').moveDown();

    if (doc.speakers.length) {
      pdf.font('bold').fontSize(13).text('Speakers').moveDown(0.15);
      for (const s of doc.speakers) {
        pdf.font('body').fontSize(10.5).text(`• ${s.label}${s.evidence ? ` — ${s.evidence}` : ''}`);
      }
      pdf.moveDown();
    }

    for (const section of doc.sections) {
      if (!section.items.length) continue;
      pdf.font('bold').fontSize(13).text(section.label).moveDown(0.15);
      for (const item of section.items) {
        const who = item.speakerLabel ? `  — ${item.speakerLabel}` : '';
        pdf.font('body').fontSize(10.5).text(`• ${item.content}${who}`);
      }
      pdf.moveDown();
    }

    if (doc.actionItems.length) {
      pdf.font('bold').fontSize(13).text('Action Items').moveDown(0.15);
      // pdfkit không có table API sẵn — canh cột thủ công là đủ cho biên bản họp.
      for (const a of doc.actionItems) {
        pdf
          .font('body')
          .fontSize(10.5)
          .text(`${a.content}  (${a.ownerLabel ?? '—'} · ${a.dueDate ?? '—'})`);
      }
    }

    pdf.end();
  });
}