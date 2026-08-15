// Shared upload utility. Dropzone and Recorder both call `performUpload`.
// The signed-URL/XHR/processing-trigger sequence is identical for both — the
// only difference is the caller (drop-a-File vs record-a-Blob).
//
// TODO: replace stubs with real http.post calls once utils/http.js lands
// (trello card #12) and the backend endpoints are live (cards #11 + #17).

async function requestSignedUrl(meetingId, meta) {
  // Real: return http.post(ENDPOINTS.meetings.upload(meetingId), meta);
  await new Promise((r) => setTimeout(r, 300));
  return {
    meeting: { id: meetingId, status: 'uploaded' },
    upload: {
      signedUrl: 'https://example.invalid/mock-upload-url',
      path: `mock/${meetingId}/${meta.originalFilename}`,
      token: 'mock-token',
    },
  };
}

function uploadBytes(signedUrl, blob, mimeType, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    // Dev stub: fake a 2s upload with progress ticks when the URL is the mock.
    if (signedUrl.includes('example.invalid')) {
      let pct = 0;
      const timer = setInterval(() => {
        pct += 0.1;
        onProgress?.(Math.min(pct, 1));
        if (pct >= 1) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
      signal?.addEventListener('abort', () => {
        clearInterval(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(blob);
  });
}

async function triggerProcessing(meetingId) {
  // Real: return http.post(ENDPOINTS.meetings.process(meetingId));
  await new Promise((r) => setTimeout(r, 200));
  return { meetingId, status: 'transcribing' };
}

/**
 * Full upload flow: signed URL → PUT to Storage → kick off processing.
 * Same call site for Dropzone (File) and Recorder (Blob).
 */
export async function performUpload(meetingId, blob, meta, { onProgress, signal } = {}) {
  const { upload } = await requestSignedUrl(meetingId, meta);
  await uploadBytes(upload.signedUrl, blob, meta.mimeType, { onProgress, signal });
  return triggerProcessing(meetingId);
}
