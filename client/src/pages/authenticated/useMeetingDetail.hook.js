import { useCallback, useEffect, useState } from 'react';
import { fetchMeetingDetail } from './meetingDetail.service.js';

// Fetches the composed GET /:id aggregate (meeting + transcript + summary +
// actionItems + speakers, ENDPOINTS.md §2) and keeps it fresh across the
// pipeline. `handleStatusChange` is a stable callback handed to
// ProcessingStatus: intermediate steps (uploaded/transcribing/summarizing)
// just patch the local status so the header badge updates; reaching a
// terminal status (completed/failed) triggers a real refetch, since only the
// server has the actual summary/error payload behind that status.
export function useMeetingDetail(id) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchMeetingDetail(id);
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState({ loading: false, error: err, data: null });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = useCallback(
    (status) => {
      setState((s) => (s.data ? { ...s, data: { ...s.data, meeting: { ...s.data.meeting, status } } } : s));
      if (status === 'completed' || status === 'failed') load();
    },
    [load],
  );

  return { ...state, refetch: load, handleStatusChange };
}
