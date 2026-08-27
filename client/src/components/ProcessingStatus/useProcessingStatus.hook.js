import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketEvent } from '../../hooks/useSocketEvent.js';
import { useSocketStore, getSocketInstance } from '../../stores/socket.store.js';
import { STATUS_STEPS } from '../../utils/constants.js';
import { fetchStatus, retryProcessing } from './processingStatus.service.js';

const STEP_LABELS = {
  uploaded: 'Queued for transcription',
  transcribing: 'Transcribing audio',
  summarizing: 'Generating summary',
  completed: 'Done',
};

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 10 * 60 * 1000;

// Primary transport: subscribe to meeting:progress/completed/failed over the
// socket. Fallback: while the socket is down, poll GET /:id/status every 3s.
// Both paths write the same `status` state, so the UI is identical either
// way (FRONTEND.md §5, ARCHITECTURE.md §3.2).
export function useProcessingStatus(meetingId, initialStatus, { onStatusChange } = {}) {
  const [status, setStatus] = useState(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const connected = useSocketStore((s) => s.connected);
  const timeoutRef = useRef(null);
  const autoStartRef = useRef(null);

  const applyStatus = useCallback(
    (next) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  useEffect(() => {
    setStatus(initialStatus);
    setTimedOut(false);
    autoStartRef.current = null;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // `uploaded` means Storage already has the file but the asynchronous AI
  // pipeline has not started yet. Normally performUpload() immediately calls
  // POST /process, but a refresh, closed tab, or transient request failure in
  // that narrow gap used to leave the meeting on "Queued" forever. Resume it
  // once when this status panel mounts; the server's status transition guard
  // prevents a duplicate start after it has moved to `transcribing`.
  useEffect(() => {
    if (status !== 'uploaded' || autoStartRef.current === meetingId) return;
    autoStartRef.current = meetingId;
    retryProcessing(meetingId)
      .then((data) => applyStatus(data.status))
      .catch(() => {
        // Keep polling/status UI alive. A manual Retry appears at the normal
        // timeout if the request remains unavailable.
        autoStartRef.current = null;
      });
  }, [status, meetingId, applyStatus]);

  // Hard timeout, started once per meeting and cancelled the moment a
  // terminal status is reached — never reset by every progress tick.
  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      return undefined;
    }
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    }
    return undefined;
  }, [status]);
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // Join/leave this meeting's progress room whenever the socket is (re)connected.
  useEffect(() => {
    if (!connected) return undefined;
    const socket = getSocketInstance();
    socket?.emit('meeting:subscribe', { meetingId });
    return () => socket?.emit('meeting:unsubscribe', { meetingId });
  }, [meetingId, connected]);

  useSocketEvent(
    'meeting:progress',
    useCallback((payload) => { if (payload.meetingId === meetingId) applyStatus(payload.status); }, [meetingId, applyStatus]),
  );
  useSocketEvent(
    'meeting:completed',
    useCallback((payload) => { if (payload.meetingId === meetingId) applyStatus('completed'); }, [meetingId, applyStatus]),
  );
  useSocketEvent(
    'meeting:failed',
    useCallback((payload) => { if (payload.meetingId === meetingId) applyStatus('failed'); }, [meetingId, applyStatus]),
  );

  // Fallback poll — only while disconnected and not yet terminal; stops the
  // instant the socket reconnects (FRONTEND.md §5).
  useEffect(() => {
    if (connected || status === 'completed' || status === 'failed') return undefined;

    let cancelled = false;
    async function poll() {
      try {
        const data = await fetchStatus(meetingId);
        if (!cancelled) applyStatus(data.status);
      } catch {
        // Transient network hiccup — the next tick tries again.
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connected, status, meetingId, applyStatus]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      const data = await retryProcessing(meetingId);
      setTimedOut(false);
      applyStatus(data.status);
    } finally {
      setRetrying(false);
    }
  }, [meetingId, applyStatus]);

  const currentIndex = Math.max(0, STATUS_STEPS.indexOf(status));

  return {
    status,
    step: STEP_LABELS[status] ?? status,
    steps: STATUS_STEPS,
    currentIndex,
    timedOut,
    retry,
    retrying,
  };
}
