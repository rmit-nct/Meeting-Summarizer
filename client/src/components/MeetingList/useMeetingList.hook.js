import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteMeeting, fetchMeetings, updateMeetingTitle } from './meetingList.service.js';

const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 350;

// Fields MeetingRow renders that GET /api/meetings does not return.
//
// `tags` is the dangerous one: the component calls meeting.tags.map(), which
// throws on undefined. `attendeeCount` and `actionItemCount` only render behind
// a > 0 check, so they degrade quietly.
//
// TODO: attendeeCount and actionItemCount should come from the API — they need
// count joins on speakers and action_items in meeting.repository.list(). `tags`
// has no column in the schema at all; drop it from the UI or add one.
function normalizeMeeting(meeting) {
  return {
    tags: [],
    attendeeCount: 0,
    actionItemCount: 0,
    durationSeconds: 0,
    ...meeting,
  };
}

// Server-side filtering and pagination — the query params already match the
// documented contract, so the service needs no translation layer.
export function useMeetingList() {
  const [filters, setFiltersState] = useState({ q: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);

  const [meetings, setMeetings] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Distinguishes "no meetings at all" from "filters matched nothing". The
  // server can't tell us both in one response, so remember whether we've ever
  // seen results with no filters applied.
  const [hasAnyMeetings, setHasAnyMeetings] = useState(false);

  const setFilters = useCallback((patch) => {
    setFiltersState((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const abortRef = useRef(null);

  useEffect(() => {
    // Debounce so typing in the search box doesn't fire a request per keystroke.
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchMeetings(
          {
            q: filters.q || undefined,
            status: filters.status || undefined,
            from: filters.from || undefined,
            to: filters.to || undefined,
            page,
            limit: PAGE_SIZE,
          },
          { signal: controller.signal },
        );

        const rows = (result.items ?? []).map(normalizeMeeting);
        setMeetings(rows);
        setTotal(result.meta?.total ?? rows.length);
        setTotalPages(result.meta?.totalPages ?? 1);

        const filtersActive = Boolean(filters.q || filters.status || filters.from || filters.to);
        if (!filtersActive && rows.length > 0) setHasAnyMeetings(true);
      } catch (err) {
        // An aborted request isn't a failure — a newer one has replaced it.
        if (err.name === 'AbortError') return;
        setError(err);
        setMeetings([]);
      } finally {
        setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters.q, filters.status, filters.from, filters.to, page]);

  const filtersActive = Boolean(filters.q || filters.status || filters.from || filters.to);

  // Optimistic against the server, rolled back on failure — same pattern as
  // useActionItemList.hook.js. There's no global meetings store to keep in
  // sync (FRONTEND.md §6), so the card's own list owns this.
  const renameMeeting = useCallback((meetingId, title) => {
    const previous = meetings;
    setMeetings((rows) => rows.map((m) => (m.id === meetingId ? { ...m, title } : m)));
    return updateMeetingTitle(meetingId, title).catch((err) => {
      setMeetings(previous);
      throw err;
    });
  }, [meetings]);

  const removeMeeting = useCallback((meetingId) => {
    const previousMeetings = meetings;
    const previousTotal = total;
    setMeetings((rows) => rows.filter((m) => m.id !== meetingId));
    setTotal((t) => Math.max(0, t - 1));
    return deleteMeeting(meetingId).catch((err) => {
      setMeetings(previousMeetings);
      setTotal(previousTotal);
      throw err;
    });
  }, [meetings, total]);

  return {
    meetings,
    filters,
    setFilters,
    page,
    setPage,
    totalPages,
    total,
    isLoading,
    error,
    renameMeeting,
    removeMeeting,
    // Only claim "no meetings yet" once we know the list is genuinely empty —
    // otherwise the empty state flashes on every page load before data arrives.
    isEmpty: !isLoading && !filtersActive && total === 0 && !hasAnyMeetings,
    isFilteredEmpty: !isLoading && filtersActive && total === 0,
  };
}