// server/src/modules/export/export.markdown.js
import { buildDocumentModel, formatDuration } from './export.model.js';

export function toMarkdown(summary, meta = {}) {
  const doc = buildDocumentModel(summary, meta);
  const lines = [];

  lines.push(`# ${doc.title}`);
  lines.push(`_${doc.date}_`);
  const duration = formatDuration(doc.durationSeconds);
  if (duration) lines.push(`Duration: ${duration}`);
  lines.push('');

  lines.push('## Overview');
  lines.push(doc.overview || '_No overview available._');
  lines.push('');

  if (doc.speakers.length) {
    lines.push('## Speakers');
    for (const s of doc.speakers) {
      lines.push(`- **${s.label}**${s.evidence ? ` — ${s.evidence}` : ''}`);
    }
    lines.push('');
  }

  for (const section of doc.sections) {
    if (!section.items.length) continue;
    lines.push(`## ${section.label}`);
    for (const item of section.items) {
      const who = item.speakerLabel ? ` _(${item.speakerLabel})_` : '';
      const ts = item.startMs != null ? ` \`[${formatDuration(item.startMs / 1000)}]\`` : '';
      lines.push(`- ${item.content}${who}${ts}`);
    }
    lines.push('');
  }

  if (doc.actionItems.length) {
    lines.push('## Action Items');
    lines.push('| Task | Owner | Due Date |');
    lines.push('|---|---|---|');
    for (const a of doc.actionItems) {
      lines.push(`| ${a.content} | ${a.ownerLabel ?? '—'} | ${a.dueDate ?? '—'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}