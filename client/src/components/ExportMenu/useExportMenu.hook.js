import { useUiStore } from '../../stores/ui.store.js';

// Real: builds the href from ENDPOINTS.meetings.export(meetingId, format) and lets the
// browser download it directly (see exportMenu.service.js) — no fetch needed. Until the
// endpoint exists, clicking surfaces an honest toast instead of a broken navigation.
export function useExportMenu(meetingId) {
  const pushToast = useUiStore((s) => s.pushToast);

  return {
    exportAs: (format) => {
      pushToast({
        tone: 'neutral',
        message: `${format.toUpperCase()} export isn't connected yet — meeting ${meetingId} will download once the API is live.`,
      });
    },
  };
}
