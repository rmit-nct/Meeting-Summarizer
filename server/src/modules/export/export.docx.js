// server/src/modules/export/export.docx.js
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
} from 'docx';
import { buildDocumentModel, formatDuration } from './export.model.js';

export async function toDocx(summary, meta = {}) {
  const doc = buildDocumentModel(summary, meta);
  const children = [];

  children.push(new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }));
  const duration = formatDuration(doc.durationSeconds);
  children.push(
    new Paragraph({ text: duration ? `${doc.date} · ${duration}` : doc.date, italics: true })
  );

  children.push(new Paragraph({ text: 'Overview', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: doc.overview || 'No overview available.' }));

  if (doc.speakers.length) {
    children.push(new Paragraph({ text: 'Speakers', heading: HeadingLevel.HEADING_1 }));
    for (const s of doc.speakers) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: s.label, bold: true }),
            new TextRun({ text: s.evidence ? ` — ${s.evidence}` : '' }),
          ],
        })
      );
    }
  }

  for (const section of doc.sections) {
    if (!section.items.length) continue;
    children.push(new Paragraph({ text: section.label, heading: HeadingLevel.HEADING_1 }));
    for (const item of section.items) {
      const who = item.speakerLabel ? ` (${item.speakerLabel})` : '';
      children.push(
        new Paragraph({ text: `${item.content}${who}`, bullet: { level: 0 } })
      );
    }
  }

  if (doc.actionItems.length) {
    children.push(new Paragraph({ text: 'Action Items', heading: HeadingLevel.HEADING_1 }));
    const headerRow = new TableRow({
      children: ['Task', 'Owner', 'Due Date'].map(
        (t) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })],
          })
      ),
    });
    const rows = doc.actionItems.map(
      (a) =>
        new TableRow({
          children: [a.content, a.ownerLabel ?? '—', a.dueDate ?? '—'].map(
            (v) => new TableCell({ children: [new Paragraph(String(v))] })
          ),
        })
    );
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] })
    );
  }

  const docxDoc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(docxDoc); // Buffer
}