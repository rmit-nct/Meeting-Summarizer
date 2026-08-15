import { useEffect, useRef, useState } from 'react';
import { STATUS_STEPS } from '../../utils/constants.js';
import { setStatus as setMockStatus } from '../../utils/mockData.js';

const STEP_LABELS = {
  uploaded: 'Queued for transcription',
  transcribing: 'Transcribing audio',
  summarizing: 'Generating summary',
  completed: 'Done',
};

const STEP_DURATION_MS = 1800;
const TIMEOUT_MS = 10 * 60 * 1000;

// Real: subscribe to `meeting:progress` / `meeting:completed` / `meeting:failed` over the
// socket (primary transport), falling back to polling GET /api/meetings/:id/status every 3s
// when the socket is down — both paths write the same `status`/`step`/`progress` state
// (FRONTEND.md §5). Until that's wired in, this simulates the same state machine entirely
// client-side and writes back to the mock store so the rest of the app (MeetingList badges,
// MeetingDetail) observes the same transition a real pipeline would produce.
export function useProcessingStatus(meetingId, initialStatus) {
  const [status, setStatus] = useState(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setStatus(initialStatus);
    setTimedOut(false);
  }, [meetingId, initialStatus]);

  useEffect(() => {
    if (status === 'completed' || status === 'failed') return undefined;

    const currentIndex = STATUS_STEPS.indexOf(status);
    if (currentIndex === -1) return undefined;

    const stepTimer = setTimeout(() => {
      const next = STATUS_STEPS[currentIndex + 1];
      if (next) {
        setMockStatus(meetingId, next);
        setStatus(next);
      }
    }, STEP_DURATION_MS);

    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    }

    return () => clearTimeout(stepTimer);
  }, [status, meetingId]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const currentIndex = Math.max(0, STATUS_STEPS.indexOf(status));

  return {
    status,
    step: STEP_LABELS[status] ?? status,
    steps: STATUS_STEPS,
    currentIndex,
    timedOut,
  };
}
