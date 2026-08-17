import { useState } from 'react';
import { PencilSimple, Check } from '@phosphor-icons/react';
import { useSpeakerLegend } from './useSpeakerLegend.hook.js';

// SpeakerLegend — rename inferred speakers, the thing that makes speaker attribution usable.
// See FRONTEND.md §3.
export default function SpeakerLegend({ meetingId, speakers: initialSpeakers }) {
  const { speakers, rename } = useSpeakerLegend(meetingId, initialSpeakers);

  if (speakers.length === 0) {
    return <p className="text-sm text-on-surface-variant">No speakers detected.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {speakers.map((speaker) => (
        <SpeakerRow key={speaker.id} speaker={speaker} onRename={(name) => rename(speaker.id, name)} />
      ))}
    </div>
  );
}

function SpeakerRow({ speaker, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(speaker.displayName);

  function save() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== speaker.displayName) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-(--radius-md) px-2 py-2 hover:bg-surface-container-low">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: speaker.color }}
        aria-hidden="true"
      />
      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          className="flex flex-1 items-center gap-2"
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            className="min-w-0 flex-1 rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <button type="submit" aria-label="Save" className="rounded-full p-1 text-primary hover:bg-primary-container/20">
            <Check size={14} weight="bold" />
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm text-on-surface">{speaker.displayName}</span>
          <span className="text-xs text-outline">{speaker.label}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Rename speaker"
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          >
            <PencilSimple size={14} weight="regular" />
          </button>
        </>
      )}
    </div>
  );
}
