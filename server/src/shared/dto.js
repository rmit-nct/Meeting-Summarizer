// The project-wide serialization transform. Every module's *.dto.js composes
// with this so internal fields never reach a client. See MODELS.md §0, ARCHITECTURE.md §2.5.
const INTERNAL_FIELDS = ['user_id', 'storage_path', 'raw_response'];

export function stripInternal(row) {
  if (!row) return row;
  const clean = { ...row };
  for (const field of INTERNAL_FIELDS) delete clean[field];
  return clean;
}

// snake_case (DB) -> camelCase (API). TODO: implement the recursive key
// transform once the first module needs it.
export function toCamel(row) {
  return row;
}
