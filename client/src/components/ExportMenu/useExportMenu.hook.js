import { useUiStore } from '../../stores/ui.store.js';
import { downloadExport } from './exportMenu.service.js';

// Real: triggers an authenticated file download via exportMenu.service.js.
export function useExportMenu(meetingId) {
  const pushToast = useUiStore((s) => s.pushToast);

  return {
    exportAs: async (format) => {
      try {
        await downloadExport(meetingId, format);
      } catch (err) {
        pushToast({
          tone: 'error',
          message: err.message ?? `Could not export as ${format.toUpperCase()}. Try again.`,
        });
      }
    },
  };
}
