import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportSummary } from './export.service.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// SUMMARY_SCHEMA (OPENAI_MODULE.md §4) Mock data
const mockSummary = {
  overview: 'Nhóm chốt deadline demo và ghi nhận rủi ro font tiếng Việt trong PDF export.',
  speakers: [
    { label: 'Speaker 1', evidence: 'giới thiệu là team lead' },
    { label: 'Speaker 2', evidence: 'phụ trách phần export' },
  ],
  points: [
    { content: 'Chốt demo vào thứ Sáu tuần sau.', category: 'decision', speakerLabel: 'Speaker 1', startMs: 4000 },
    { content: 'PDF export đang mất dấu tiếng Việt — cần embed font trước khi ship.', category: 'blocker', speakerLabel: 'Speaker 2', startMs: 38000 },
    { content: 'Có nên dùng gpt-5.6-terra nếu chất lượng tiếng Việt không đủ?', category: 'question', speakerLabel: 'Speaker 1', startMs: 61000 },
  ],
  actionItems: [
    { content: 'Embed Be Vietnam Pro vào PDF renderer.', ownerLabel: 'Speaker 2', dueDate: '2026-08-20' },
    { content: 'Viết fixture summary-sample.json thật.', ownerLabel: 'Speaker 1', dueDate: null },
  ],
};

const outDir = path.resolve(here, '../../../tmp-export-test');
fs.mkdirSync(outDir, { recursive: true });

for (const format of ['md', 'docx', 'pdf']) {
  const result = await exportSummary(format, mockSummary, {
    title: 'Weekly Sync',
    date: '2026-08-16',
    durationSeconds: 1830,
  });
  const filePath = path.join(outDir, `output.${format}`);
  fs.writeFileSync(filePath, result);
  console.log('Wrote', filePath);
}