import { useMemo, useState } from 'react';
import { useMockMeetings } from '../../utils/mockData.js';

const PAGE_SIZE = 8;

// Real: fetch via meetingList.service.js on mount + whenever `filters`/`page` change, with
// loading/error state. `useMockMeetings()` is already reactive (any mock mutation re-renders
// every subscriber), so for now filtering/pagination just run in memory.
export function useMeetingList() {
  const allMeetings = useMockMeetings();
  const [filters, setFiltersState] = useState({ q: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);

  const setFilters = (patch) => {
    setFiltersState((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const filtered = useMemo(() => {
    return allMeetings
      .filter((m) => {
        if (filters.q && !m.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
        if (filters.status && m.status !== filters.status) return false;
        if (filters.from && m.meetingDate < filters.from) return false;
        if (filters.to && m.meetingDate > filters.to) return false;
        return true;
      })
      .sort((a, b) => (a.meetingDate < b.meetingDate ? 1 : -1));
  }, [allMeetings, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    meetings: pageItems,
    filters,
    setFilters,
    page,
    setPage,
    totalPages,
    total: filtered.length,
    isEmpty: allMeetings.length === 0,
    isFilteredEmpty: filtered.length === 0 && allMeetings.length > 0,
  };
}
