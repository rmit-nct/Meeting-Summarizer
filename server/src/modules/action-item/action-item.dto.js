// Shapes action item rows for the API boundary. Composes with shared/dto.js.
import { stripInternal, toCamel } from '../../shared/dto.js';

export function toApi(row) {
  if (!row) return null;
  return toCamel(stripInternal(row));
}

export function toApiList(rows) {
  return (rows ?? []).map(toApi);
}