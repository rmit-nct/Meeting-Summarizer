import { useEffect, useRef } from 'react';
import { formatTimestamp } from '../../utils/format.js';

// TranscriptView — segment list with timestamps and in-page highlight. See FRONTEND.md §3.
// `highlightMs` is set by MeetingDetail when a SummaryView point is "jumped to" — the matching
// segment gets a highlight ring and scrolls into view.
export default function TranscriptView({ segments, speakers, highlightMs }) {
  const refs = useRef({});
  const speakerById = Object.fromEntries(speakers.map((s) => [s.id, s]));

  const activeSegment = typeof highlightMs === 'number'
    ? segments.find((s) => highlightMs >= s.startMs && highlightMs < s.endMs)
    : null;

  useEffect(() => {
    if (activeSegment && refs.current[activeSegment.id]) {
      refs.current[activeSegment.id].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeSegment]);

  if (segments.length === 0) {
    return <p className="py-8 text-center text-sm text-on-surface-variant">No transcript available.</p>;
  }

  return (
    <div className="relative flex flex-col gap-5 border-l-2 border-outline-variant/60 pl-5">
      {segments.map((segment) => {
        const speaker = speakerById[segment.speakerId];
        const isActive = activeSegment?.id === segment.id;
        return (
          <div
            key={segment.id}
            ref={(el) => { refs.current[segment.id] = el; }}
            className={[
              '-ml-[26px] rounded-(--radius-md) py-1.5 pl-[26px] pr-2 transition-colors',
              isActive ? 'bg-primary-container/20 ring-1 ring-primary/40' : '',
            ].join(' ')}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-xs text-outline">{formatTimestamp(segment.startMs / 1000)}</span>
              {speaker && <span className="text-xs font-semibold text-primary">{speaker.displayName}</span>}
            </div>
            <p className="text-sm leading-relaxed text-on-surface">{segment.text}</p>
          </div>
        );
      })}
    </div>
  );
}
