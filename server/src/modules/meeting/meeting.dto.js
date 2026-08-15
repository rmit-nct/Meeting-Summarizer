// Shapes meeting rows for the API boundary. Composes with shared/dto.js.
import { stripInternal, toCamel } from '../../shared/dto.js';
import { STATUS_PROGRESS, STATUS_STEP } from '../../shared/constants.js';

// stripInternal removes user_id and storage_path. storage_path especially:
// it is the object key in a private bucket and must never be serialized —
// the client only ever receives short-lived signed URLs. See MODELS.md §0.
export function toApi(row) {
  if (!row) return null;
  return toCamel(stripInternal(row));
}

export function toApiList(rows) {
  return (rows ?? []).map(toApi);
}

// The shape GET /:id/status returns. Progress is a fixed lookup per status, not
// a measurement — it exists so the bar moves. See ARCHITECTURE.md §4.1.
export function toStatus(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    progress: STATUS_PROGRESS[row.status] ?? 0,
    step: STATUS_STEP[row.status] ?? '',
    errorMessage: row.error_message ?? null,
  };
}