import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlass, CaretLeft, CaretRight, Clock,
  ListChecks, UsersThree, FilePlus, WarningCircle, Check, X,
} from '@phosphor-icons/react';
import Card from '../ui/Card/index.jsx';
import Badge from '../ui/Badge/index.jsx';
import Input from '../ui/Input/index.jsx';
import Button from '../ui/Button/index.jsx';
import IconButton from '../ui/IconButton/index.jsx';
import EmptyState from '../ui/EmptyState/index.jsx';
import { useUiStore } from '../../stores/ui.store.js';
import { STATUS_META, UNKNOWN_STATUS_META } from '../../utils/constants.js';
import { formatDate, formatDurationMinutes } from '../../utils/format.js';
import { useMeetingList } from './useMeetingList.hook.js';
import MeetingCardMenu from './sub-components/MeetingCardMenu.jsx';

// MeetingList — history rows, keyword search, date range, pagination. See FRONTEND.md §3.
export default function MeetingList() {
  const {
    meetings, filters, setFilters, page, setPage, totalPages, total,
    isEmpty, isFilteredEmpty, renameMeeting, removeMeeting,
  } = useMeetingList();

  if (isEmpty) {
    return (
      <EmptyState
        icon={FilePlus}
        title="No meetings yet"
        description="Upload a recording or start one live to get your first summary."
        action={<Button to="/meetings/new" className="mt-2">New meeting</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          label="Search"
          className="sm:flex-1"
          leadingIcon={MagnifyingGlass}
          placeholder="Search meetings by title…"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="From date"
            value={filters.from}
            onChange={(e) => setFilters({ from: e.target.value })}
            className="h-11 rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <input
            type="date"
            aria-label="To date"
            value={filters.to}
            onChange={(e) => setFilters({ to: e.target.value })}
            className="h-11 rounded-(--radius-md) border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      {isFilteredEmpty ? (
        <EmptyState
          icon={MagnifyingGlass}
          title="No meetings match your filters"
          description="Try a different keyword or widen the date range."
          action={
            <Button variant="outline" onClick={() => setFilters({ q: '', status: '', from: '', to: '' })}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              onRename={(title) => renameMeeting(meeting.id, title)}
              onDelete={() => removeMeeting(meeting.id)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-outline">
            Page {page} of {totalPages} · {total} meetings
          </p>
          <div className="flex gap-2">
            <IconStep disabled={page <= 1} onClick={() => setPage(page - 1)} icon={CaretLeft} label="Previous page" />
            <IconStep disabled={page >= totalPages} onClick={() => setPage(page + 1)} icon={CaretRight} label="Next page" />
          </div>
        </div>
      )}
    </div>
  );
}

function IconStep({ icon: Icon, label, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-(--radius-md) border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      <Icon size={16} weight="regular" />
    </button>
  );
}

function MeetingRow({ meeting, onRename, onDelete }) {
  const statusMeta = STATUS_META[meeting.status] ?? UNKNOWN_STATUS_META;
  const pushToast = useUiStore((s) => s.pushToast);
  const [isEditing, setIsEditing] = useState(false);

  async function handleDelete() {
    try {
      await onDelete();
    } catch {
      pushToast({ tone: 'error', message: 'Could not delete this meeting — try again.' });
      throw new Error('delete failed');
    }
  }

  return (
    <Card interactive={!isEditing} padding="md" className="group relative">
      <div className="absolute right-3 top-3 z-[1]">
        <MeetingCardMenu onEdit={() => setIsEditing(true)} onDelete={handleDelete} />
      </div>

      <Link
        to={`/meetings/${meeting.id}`}
        className="flex flex-col gap-3"
        onClick={(e) => {
          if (isEditing) e.preventDefault();
        }}
      >
        <div className="flex items-start justify-between gap-3 pr-9">
          <div className="flex flex-wrap items-center gap-2">
            {meeting.tags.map((tag) => (
              <Badge key={tag} tone="neutral">{tag}</Badge>
            ))}
            <span className="text-xs text-outline">{formatDate(meeting.meetingDate)}</span>
          </div>
          <Badge tone={statusMeta.tone} dot>{statusMeta.label}</Badge>
        </div>

        {isEditing ? (
          <EditableTitle
            initialValue={meeting.title}
            onSave={onRename}
            onDone={() => setIsEditing(false)}
            onError={() => pushToast({ tone: 'error', message: 'Could not rename this meeting — try again.' })}
          />
        ) : (
          <h3 className="text-base font-medium text-on-surface transition-colors group-hover:text-primary">
            {meeting.title}
          </h3>
        )}

        {meeting.status === 'failed' && meeting.errorMessage && (
          <p className="flex items-start gap-1.5 text-xs text-error">
            <WarningCircle size={14} weight="regular" className="mt-0.5 shrink-0" />
            {meeting.errorMessage}
          </p>
        )}

        <div className="mt-1 flex items-center gap-4 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <UsersThree size={14} weight="regular" />
            {meeting.attendeeCount} attendees
          </span>
          {meeting.durationSeconds > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock size={14} weight="regular" />
              {formatDurationMinutes(meeting.durationSeconds / 60)}
            </span>
          )}
          {meeting.actionItemCount > 0 && (
            <span className="flex items-center gap-1.5">
              <ListChecks size={14} weight="regular" />
              {meeting.actionItemCount} actions
            </span>
          )}
        </div>
      </Link>
    </Card>
  );
}

// Replaces the <h3> title in place. Lives inside the card's <Link>, so every
// interaction here must stop propagation or the click/Enter that saves would
// also navigate to the meeting.
function EditableTitle({ initialValue, onSave, onDone, onError }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialValue) return onDone();
    setSaving(true);
    try {
      await onSave(trimmed);
      onDone();
    } catch {
      onError();
      onDone();
    }
  }

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onDone();
        }}
        className="h-9 w-full rounded-(--radius-md) border border-primary bg-surface-container-lowest px-2.5 text-base font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      <IconButton icon={Check} size="sm" label="Save" disabled={saving} onClick={save} />
      <IconButton icon={X} size="sm" label="Cancel" disabled={saving} onClick={onDone} />
    </div>
  );
}
