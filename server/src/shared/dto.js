// The project-wide serialization transform. Every module's *.dto.js composes
// with this so internal fields never reach a client. See MODELS.md §0, ARCHITECTURE.md §2.5.
const INTERNAL_FIELDS = ['user_id', 'storage_path', 'raw_response'];

export function stripInternal(row) {
  if (!row) return row;
  const clean = { ...row };
  for (const field of INTERNAL_FIELDS) delete clean[field];
  return clean;
}

// snake_case -> camelCase, one segment. Postgres columns are single-level
// snake_case (MODELS.md §0), so this never needs to handle nested delimiters.
function camelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// Recursive snake_case (DB) -> camelCase (API) transform. Walks plain objects
// and arrays only — anything else (Date, null, primitive) is returned as-is,
// so this is safe to run on an already-shaped DTO or a raw repository row.
export function toCamel(value) {
  if (Array.isArray(value)) return value.map(toCamel);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[camelKey(key)] = toCamel(val);
  }
  return out;
}

// Composes strip + camelize — the one call most *.dto.js files need for a
// single row. Kept as a named export (not a default) so call sites stay
// self-documenting at a glance.
export function shape(row) {
  return toCamel(stripInternal(row));
}

export function shapeList(rows) {
  return (rows ?? []).map(shape);
}
