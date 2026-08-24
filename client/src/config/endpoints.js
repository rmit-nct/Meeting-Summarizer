// Single source of truth for backend paths. See ENDPOINTS.md §9.
export const ENDPOINTS = {
  auth: { register: () => '/api/auth/register', login: () => '/api/auth/login', refresh: () => '/api/auth/refresh', logout: () => '/api/auth/logout', me: () => '/api/auth/me' },
  meetings: {
    create:      () => '/api/meetings',
    list:        () => '/api/meetings',
    detail:      (id) => `/api/meetings/${id}`,
    update:      (id) => `/api/meetings/${id}`,
    remove:      (id) => `/api/meetings/${id}`,
    upload:      (id) => `/api/meetings/${id}/upload`,
    process:     (id) => `/api/meetings/${id}/process`,
    resummarize: (id) => `/api/meetings/${id}/resummarize`,
    status:      (id) => `/api/meetings/${id}/status`,
    speakers:    (id) => `/api/meetings/${id}/speakers`,
    export:      (id, format) => `/api/meetings/${id}/export?format=${format}`,
  },
  actionItems: {
    list: () => '/api/action-items',
    byId: (id) => `/api/action-items/${id}`,
  },
  users: { me: () => '/api/users/me' },
};