// The project-wide response envelope. Every route uses these. See ARCHITECTURE.md §2.5.
export function success(data, meta) {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function failure(code, message, details) {
  return { success: false, error: { code, message, ...(details ? { details } : {}) } };
}

export function paginate(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
