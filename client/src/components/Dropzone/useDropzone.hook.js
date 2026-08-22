import { useCallback, useRef, useState } from 'react';
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES, formatBytes } from '../../utils/constants.js';
import { uploadDroppedFile } from './dropzone.service.js';

// State machine: idle → dragging → validating → (rejected | uploading) → (uploaded | error)
export function useDropzone({ meetingId, onUploaded }) {
  const [status, setStatus] = useState('idle');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const validate = useCallback((f) => {
    if (!ACCEPTED_MIME.includes(f.type)) {
      return `This file type isn't supported. Try audio, video, or a .vtt / .srt transcript.`;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      return `File is too large. Max size is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
    }
    return null;
  }, []);

  const handleSelect = useCallback(
    async (picked) => {
      if (!picked) return;
      setFile(picked);
      setProgress(0);
      setError(null);
      setStatus('validating');

      const validationError = validate(picked);
      if (validationError) {
        setError(validationError);
        setStatus('rejected');
        return;
      }

      try {
        setStatus('uploading');
        const controller = new AbortController();
        abortRef.current = controller;

        await uploadDroppedFile(meetingId, picked, {
          onProgress: setProgress,
          signal: controller.signal,
        });

        setStatus('uploaded');
        onUploaded?.();
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('idle');
          setFile(null);
          setProgress(0);
          return;
        }
        setError(err.message || 'Upload failed');
        setStatus('error');
      }
    },
    [meetingId, onUploaded, validate],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setStatus('idle');
      const picked = e.dataTransfer?.files?.[0];
      if (picked) handleSelect(picked);
    },
    [handleSelect],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setStatus((s) => (s === 'idle' || s === 'rejected' ? 'dragging' : s));
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setStatus((s) => (s === 'dragging' ? 'idle' : s));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (file) handleSelect(file);
  }, [file, handleSelect]);

  const reset = useCallback(() => {
    setStatus('idle');
    setFile(null);
    setProgress(0);
    setError(null);
  }, []);

  return {
    status, file, progress, error,
    handleSelect, handleDrop, handleDragOver, handleDragLeave,
    cancel, retry, reset,
  };
}
