// server/src/modules/export/export.service.js
import { toMarkdown } from './export.markdown.js';
import { toDocx } from './export.docx.js';
import { toPdf } from './export.pdf.js';

const EXPORTERS = { md: toMarkdown, docx: toDocx, pdf: toPdf };

/**
 * @param {'md'|'docx'|'pdf'} format
 * @param {object} summary - JSON theo SUMMARY_SCHEMA (xem OPENAI_MODULE.md §4)
 * @param {object} [meta] - { title, date, durationSeconds } — Kiệt tự lấy từ bảng `meetings`
 * @returns {Promise<Buffer|string>} - string khi 'md', Buffer khi 'docx'/'pdf'
 */
export async function exportSummary(format, summary, meta = {}) {
  const fn = EXPORTERS[format];
  if (!fn) throw new Error(`Unsupported export format: ${format}`);
  return fn(summary, meta);
}