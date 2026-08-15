import { toggleActionItem, updateActionItem, addActionItem, deleteActionItem } from '../../utils/mockData.js';

// Real: each of these calls actionItemList.service.js (PATCH/POST/DELETE /api/action-items),
// optimistically updating local state and rolling back on failure. Until then they write
// straight to the mock store, which is already reactive.
export function useActionItemList(meetingId) {
  return {
    toggle: (itemId) => toggleActionItem(meetingId, itemId),
    update: (itemId, patch) => updateActionItem(meetingId, itemId, patch),
    add: (data) => addActionItem(meetingId, data),
    remove: (itemId) => deleteActionItem(meetingId, itemId),
  };
}
