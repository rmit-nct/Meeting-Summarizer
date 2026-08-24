const CATEGORIES = ['decision', 'action', 'question', 'blocker', 'risk', 'discussion'];

// Mirrors the UI's category accents (client/src/index.css --color-cat-*,
// client/src/utils/constants.js CATEGORY_META) so an export looks like the
// same product, not a generic document dump.
const CATEGORY_LABELS = {
  decision: 'Decisions',
  action: 'Actions',
  question: 'Questions',
  blocker: 'Blockers',
  risk: 'Risks',
  discussion: 'Discussion',
};

const CATEGORY_COLORS = {
  decision: '#2f7d5c',
  action: '#3d5a99',
  question: '#815600',
  blocker: '#ba1a1a',
  risk: '#b75e20',
  discussion: '#6f797d',
};

/**
 * Chuẩn hóa summary JSON (theo SUMMARY_SCHEMA, xem OPENAI_MODULE.md §4) thành model dễ render.
 * @param {object} summary - JSON trả về từ summary.service.js (SUMMARY_SCHEMA), extended by
 *   export.adapter.js with `transcript` (see toExportTranscript) — not part of the LLM schema.
 * @param {object} [meta] - { title, date, durationSeconds } — KHÔNG nằm trong summary JSON,
 *   Kiệt tự lấy từ bảng `meetings` và truyền vào. Không bắt buộc field nào.
 */
export function buildDocumentModel(summary, meta = {}) {
  const points = summary.points ?? [];
  const actionItems = summary.actionItems ?? [];
  const speakers = summary.speakers ?? [];

  const byCategory = Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat,
      points.filter((p) => (p.category ?? '').toLowerCase() === cat),
    ])
  );

  // Category lạ (model trả sai enum, hoặc enum thật đổi sau này) — fallback, tránh mất data.
  const other = points.filter(
    (p) => !CATEGORIES.includes((p.category ?? '').toLowerCase())
  );

  return {
    title: meta.title ?? 'Meeting Summary',
    date: meta.date ?? new Date().toISOString().slice(0, 10),
    durationSeconds: meta.durationSeconds ?? null,
    overview: summary.overview ?? '',
    speakers,
    sections: [
      ...CATEGORIES.map((cat) => ({
        label: CATEGORY_LABELS[cat],
        color: CATEGORY_COLORS[cat],
        items: byCategory[cat],
      })),
      ...(other.length ? [{ label: 'Other', color: '#6f797d', items: other }] : []),
    ],
    actionItems,
    actionItemsDone: actionItems.filter((a) => a.isDone).length,
    transcript: summary.transcript ?? null,
  };
}

export function formatDuration(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
