// The project-wide serialization transform. Every module's *.dto.js composes
// with this so internal fields never reach a client. See MODELS.md §0, ARCHITECTURE.md §2.5.
const INTERNAL_FIELDS = ['user_id', 'storage_path', 'raw_response'];

export function stripInternal(row) {
  if (!row) return row;
  const clean = { ...row };
  for (const field of INTERNAL_FIELDS) delete clean[field];
  return clean;
}

const camelCache = new Map();

function camelKey(key) {
  if (camelCache.has(key)) return camelCache.get(key);
  const out = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  camelCache.set(key, out);
  return out;
}

// snake_case (DB) -> camelCase (API).
//
// Recursive, so nested rows composed by overview.service are converted in one
// pass. Two things it deliberately does NOT touch:
//
//   - Date objects. supabase-js returns timestamptz as ISO strings already, but
//     if a Date ever slips through, spreading it would produce {} and silently
//     destroy the value.
//   - jsonb payloads whose keys are data rather than column names. `segments`
//     is ours so camelCasing it is fine, but if you ever store user- or
//     model-supplied keys in jsonb, convert that column before it gets here.
export function toCamel(value) {
  if (Array.isArray(value)) return value.map(toCamel);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[camelKey(key)] = toCamel(val);
  }
  return out;
}