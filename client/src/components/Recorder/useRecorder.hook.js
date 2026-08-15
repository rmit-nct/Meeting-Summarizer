import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadRecording } from './recorder.service.js';

// State machine: idle → requesting → recording → preview → uploading → uploaded | error
// Also: requesting → permission-denied

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function useRecorder({ meetingId, onUploaded }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [blob, setBlob] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [progress, setProgress] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const reset = useCallback(() => {
    stopTimer();
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
    setError(null);
    setElapsedMs(0);
    setBlob(null);
    setMimeType(null);
    setProgress(0);
  }, []);

  useEffect(() => reset, [reset]); // cleanup on unmount

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support in-browser recording.');
      setStatus('error');
      return;
    }
    const type = pickMimeType();
    if (!type) {
      setError('No supported audio recording format found in this browser.');
      setStatus('error');
      return;
    }

    setError(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: type });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        releaseStream();
        const finalBlob = new Blob(chunksRef.current, { type });
        setBlob(finalBlob);
        setMimeType(type);
        setStatus('preview');
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      setStatus('recording');
    } catch (err) {
      releaseStream();
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setError(
        denied
          ? 'Microphone access was blocked. Enable it in your browser settings and try again.'
          : err?.message || 'Could not start recording.',
      );
      setStatus(denied ? 'permission-denied' : 'error');
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const discard = useCallback(() => {
    reset();
  }, [reset]);

  const submit = useCallback(async () => {
    if (!blob || !mimeType) return;
    setStatus('uploading');
    setProgress(0);
    setError(null);
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      await uploadRecording(meetingId, blob, mimeType, {
        onProgress: setProgress,
        signal: controller.signal,
      });
      setStatus('uploaded');
      onUploaded?.();
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('preview');
        setProgress(0);
        return;
      }
      setError(err.message || 'Upload failed');
      setStatus('error');
    }
  }, [blob, mimeType, meetingId, onUploaded]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    status, error, elapsedMs, blob, mimeType, progress,
    start, stop, discard, submit, cancelUpload, reset,
  };
}
