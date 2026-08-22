import { useMemo, useState } from 'react';
import { Sparkle, Clock } from '@phosphor-icons/react';
import Card from '../ui/Card/index.jsx';
import { CATEGORY_META } from '../../utils/constants.js';
import { formatTimestamp } from '../../utils/format.js';

// SummaryView — bullets grouped by category + filter chips + speaker chips + jump-to-timestamp.
// See FRONTEND.md §3. `onJumpToTranscript` lets a point hand off to <TranscriptView/> via
// MeetingDetail, which owns the tab state both components live under.
export default function SummaryView({ overview, points, speakers, onJumpToTranscript }) {
  const [category, setCategory] = useState('all');
  const [speakerId, setSpeakerId] = useState('all');

  const categoriesPresent = useMemo(
    () => [...new Set(points.map((p) => p.category))],
    [points],
  );

  const filtered = points.filter(
    (p) => (category === 'all' || p.category === category) && (speakerId === 'all' || p.speaker?.id === speakerId),
  );

  return (
    <div className="flex flex-col gap-6">
      <Card padding="lg">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Sparkle size={18} weight="regular" />
          <h2 className="text-base font-medium text-on-surface">Executive summary</h2>
        </div>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-on-surface-variant">
          {overview.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={category === 'all'} onClick={() => setCategory('all')}>All</FilterChip>
        {categoriesPresent.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_META[c]?.label ?? c}
          </FilterChip>
        ))}
        {speakers.length > 1 && (
          <>
            <span className="mx-1 h-4 w-px bg-outline-variant" />
            <FilterChip active={speakerId === 'all'} onClick={() => setSpeakerId('all')}>Everyone</FilterChip>
            {speakers.map((s) => (
              <FilterChip key={s.id} active={speakerId === s.id} onClick={() => setSpeakerId(s.id)}>
                {s.displayName}
              </FilterChip>
            ))}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((point) => (
          <SummaryPoint key={point.id} point={point} onJumpToTranscript={onJumpToTranscript} />
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-on-surface-variant">No points match this filter.</p>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SummaryPoint({ point, onJumpToTranscript }) {
  const meta = CATEGORY_META[point.category] ?? CATEGORY_META.discussion;
  return (
    <Card
      padding="none"
      className="border-l-4 p-4 pl-5"
      style={{ borderLeftColor: `var(--color-cat-${point.category})` }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
          {meta.label}
        </span>
        {point.speaker && <span className="text-xs text-on-surface-variant">{point.speaker.displayName}</span>}
      </div>
      <p className="text-sm text-on-surface">{point.content}</p>
      {typeof point.startMs === 'number' && onJumpToTranscript && (
        <button
          type="button"
          onClick={() => onJumpToTranscript(point.startMs)}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Clock size={13} weight="regular" />
          {formatTimestamp(point.startMs / 1000)} in transcript
        </button>
      )}
    </Card>
  );
}
