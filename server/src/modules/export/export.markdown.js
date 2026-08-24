// server/src/modules/export/export.markdown.js
import { buildDocumentModel, formatDuration } from './export.model.js';

export function toMarkdown(summary, meta = {}) {
  const doc = buildDocumentModel(summary, meta);
  const lines = [];

  lines.push(`# ${doc.title}`);
  const duration = formatDuration(doc.durationSeconds);
  const metaBits = [`**Date:** ${doc.date}`];
  if (duration) metaBits.push(`**Duration:** ${duration}`);
  if (doc.speakers.length) metaBits.push(`**Speakers:** ${doc.speakers.length}`);
  lines.push(metaBits.join('  ·  '));
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(doc.overview || '_No overview available._');
  lines.push('');

  if (doc.speakers.length) {
    lines.push('## Speakers');
    lines.push('');
    for (const s of doc.speakers) {
      lines.push(`- ${s.label}${s.evidence ? ` — ${s.evidence}` : ''}`);
    }
    lines.push('');
  }

  for (const section of doc.sections) {
    if (!section.items.length) continue;
    lines.push(`## ${section.label}`);
    lines.push('');
    for (const item of section.items) {
      const who = item.speakerLabel ? ` _(${item.speakerLabel})_` : '';
      const ts = item.startMs != null ? ` \`[${formatDuration(item.startMs / 1000)}]\`` : '';
      lines.push(`- ${item.content}${who}${ts}`);
    }
    lines.push('');
  }

  if (doc.actionItems.length) {
    lines.push(`## Action Items (${doc.actionItemsDone}/${doc.actionItems.length} completed)`);
    lines.push('');
    for (const a of doc.actionItems) {
      const box = a.isDone ? '[x]' : '[ ]';
      const meta2 = [a.ownerLabel ?? 'Unassigned', a.dueDate ? `Due ${a.dueDate}` : null]
        .filter(Boolean)
        .join('  ·  ');
      lines.push(`- ${box} ${a.content}  _(${meta2})_`);
    }
    lines.push('');
  }

  if (doc.transcript) {
    lines.push('---');
    lines.push('');
    lines.push('## Full Transcript');
    lines.push('');
    if (doc.transcript.kind === 'segments') {
      for (const seg of doc.transcript.segments) {
        const ts = seg.startMs != null ? `[${formatDuration(seg.startMs / 1000)}] ` : '';
        const who = seg.speakerLabel ? `**${seg.speakerLabel}:** ` : '';
        lines.push(`${ts}${who}${seg.text}`);
        lines.push('');
      }
    } else {
      for (const para of doc.transcript.text.split(/\n{2,}/)) {
        lines.push(para);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
