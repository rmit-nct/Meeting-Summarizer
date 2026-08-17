// Shapes meeting rows for the API boundary. Composes with shared/dto.js.
import { shape } from '../../shared/dto.js';

// Full row shape (used by the `POST`/`PATCH` responses and by `overview`).
// storage_path/user_id are stripped by shape(); nothing else on `meetings`
// is internal-only.
export function toMeetingDto(row) {
  return shape(row);
}

// GET /api/meetings history rows — a deliberately smaller projection
// (ENDPOINTS.md §2), with the one derived field (`actionItemCount`) merged in
// by the service before this runs.
export function toMeetingSummaryDto(row, actionItemCount = 0) {
  const full = shape(row);
  return {
    id: full.id,
    title: full.title,
    status: full.status,
    meetingDate: full.meetingDate,
    durationSeconds: full.durationSeconds,
    actionItemCount,
    createdAt: full.createdAt,
  };
}
