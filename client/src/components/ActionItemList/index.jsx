import { useState } from 'react';
import { Plus, Trash, PencilSimple, Check, X } from '@phosphor-icons/react';
import { formatDate } from '../../utils/format.js';
import { useActionItemList } from './useActionItemList.hook.js';

// ActionItemList — checkbox, inline edit of content/owner/due date, add, delete.
// See FRONTEND.md §3.
export default function ActionItemList({ meetingId, items: initialItems }) {
  const { items, toggle, update, add, remove } = useActionItemList(meetingId, initialItems);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-on-surface-variant">No action items yet.</p>
      )}

      {items.map((item) => (
        <ActionItemRow key={item.id} item={item} onToggle={() => toggle(item.id)} onUpdate={(patch) => update(item.id, patch)} onDelete={() => remove(item.id)} />
      ))}

      {adding ? (
        <NewItemRow onCancel={() => setAdding(false)} onCreate={(data) => { add(data); setAdding(false); }} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-2 rounded-(--radius-md) px-2 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-container/15"
        >
          <Plus size={16} weight="regular" />
          Add action item
        </button>
      )}
    </div>
  );
}

function ActionItemRow({ item, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <NewItemRow
        initial={item}
        onCancel={() => setEditing(false)}
        onCreate={(data) => { onUpdate(data); setEditing(false); }}
        submitLabel="Save"
      />
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-(--radius-md) px-2 py-2.5 transition-colors hover:bg-surface-container-low">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.isDone}
        aria-label={item.isDone ? 'Mark as not done' : 'Mark as done'}
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          item.isDone ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-surface-container-lowest',
        ].join(' ')}
      >
        {item.isDone && <Check size={13} weight="bold" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${item.isDone ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
          {item.content}
        </p>
        <p className="mt-0.5 text-xs text-outline">
          {item.ownerLabel || 'Unassigned'}
          {item.dueDate && ` · Due ${formatDate(item.dueDate)}`}
        </p>
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={() => setEditing(true)} aria-label="Edit" className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface">
          <PencilSimple size={15} weight="regular" />
        </button>
        <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-full p-1.5 text-on-surface-variant hover:bg-error/10 hover:text-error">
          <Trash size={15} weight="regular" />
        </button>
      </div>
    </div>
  );
}

function NewItemRow({ initial, onCancel, onCreate, submitLabel = 'Add' }) {
  const [content, setContent] = useState(initial?.content ?? '');
  const [ownerLabel, setOwnerLabel] = useState(initial?.ownerLabel ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');

  function submit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    onCreate({ content: content.trim(), ownerLabel: ownerLabel.trim(), dueDate });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-(--radius-md) border border-outline-variant/60 bg-surface-container-low p-3">
      <input
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What needs to happen?"
        className="rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      <div className="flex gap-2">
        <input
          value={ownerLabel}
          onChange={(e) => setOwnerLabel(e.target.value)}
          placeholder="Owner"
          className="min-w-0 flex-1 rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex items-center gap-1 rounded-(--radius-md) px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high">
          <X size={14} weight="regular" />
          Cancel
        </button>
        <button type="submit" className="flex items-center gap-1 rounded-(--radius-md) bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90">
          <Check size={14} weight="regular" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
