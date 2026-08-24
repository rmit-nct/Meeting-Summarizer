// API calls scoped to the MeetingHistory page. Mirrors meetingDetail.service.js's
// pattern (FRONTEND.md §3 convention, applied to a page since this fetch is
// specific to the dashboard stat tiles, not the <MeetingList/> component below them).
import { http } from '../../utils/http.js';
import { ENDPOINTS } from '../../config/endpoints.js';

const PAGE_LIMIT = 50; // server-side max — see meeting.validator.js

// There's no dedicated stats endpoint (ENDPOINTS.md documents none), so the
// stat tiles are computed client-side from every meeting the user has —
// walks GET /api/meetings page by page, unfiltered.
export async function fetchAllMeetings({ signal } = {}) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    const result = await http.get(`${ENDPOINTS.meetings.list()}?${params.toString()}`, { signal });
    all.push(...(result.items ?? []));
    totalPages = result.meta?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}
