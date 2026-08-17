import { useState } from 'react';
import { create, patch, remove as removeRequest } from './actionItemList.service.js';

// NewItemRow (index.jsx) submits `ownerLabel`/`dueDate` as '' when the user
// leaves them blank. The server's create schema wants the key omitted
// entirely (empty string fails the date/min-length checks); the update
// schema additionally accepts `null` to mean "clear this field" — so '' maps
// to null on update (clears it) but is dropped on create (nothing to clear).
function sanitize(fields, { allowNull } = {}) {
  const clean = { ...fields };
  for (const key of ['ownerLabel', 'dueDate']) {
    if (clean[key] !== '') continue;
    if (allowNull) clean[key] = null;
    else delete clean[key];
  }
  return clean;
}

// Owns the working copy of this meeting's action items. There is no global
// store for meeting data (FRONTEND.md §6 caps stores/ at three, and "if
// something is used by one component, it belongs in that component's hook")
// — `initialItems` seeds local state from the parent's fetch, then every
// mutation here is optimistic against the server with a rollback on failure.
export function useActionItemList(meetingId, initialItems) {
  const [items, setItems] = useState(initialItems ?? []);

  function applyOptimistic(next, request) {
    const previous = items;
    setItems(next);
    request().catch((err) => {
      setItems(previous);
      throw err;
    });
  }

  function toggle(itemId) {
    const target = items.find((i) => i.id === itemId);
    if (!target) return;
    applyOptimistic(
      items.map((i) => (i.id === itemId ? { ...i, isDone: !i.isDone } : i)),
      () => patch(itemId, { isDone: !target.isDone }),
    );
  }

  function update(itemId, fields) {
    const sanitized = sanitize(fields, { allowNull: true });
    applyOptimistic(
      items.map((i) => (i.id === itemId ? { ...i, ...sanitized } : i)),
      () => patch(itemId, sanitized),
    );
  }

  async function add(data) {
    const { actionItem } = await create({ meetingId, ...sanitize(data) });
    setItems((current) => [...current, actionItem]);
  }

  function remove(itemId) {
    applyOptimistic(
      items.filter((i) => i.id !== itemId),
      () => removeRequest(itemId),
    );
  }

  return { items, toggle, update, add, remove };
}
