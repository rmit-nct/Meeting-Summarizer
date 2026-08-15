import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, UsersThree, Clock } from '@phosphor-icons/react';
import Dropzone from '../../components/Dropzone/index.jsx';
import Recorder from '../../components/Recorder/index.jsx';
import ProcessingStatus from '../../components/ProcessingStatus/index.jsx';
import SummaryView from '../../components/SummaryView/index.jsx';
import TranscriptView from '../../components/TranscriptView/index.jsx';
import ActionItemList from '../../components/ActionItemList/index.jsx';
import SpeakerLegend from '../../components/SpeakerLegend/index.jsx';
import ExportMenu from '../../components/ExportMenu/index.jsx';
import EmptyState from '../../components/ui/EmptyState/index.jsx';
import Badge from '../../components/ui/Badge/index.jsx';
import Button from '../../components/ui/Button/index.jsx';
import { STATUS_META } from '../../utils/constants.js';
import { formatDate, formatDurationMinutes } from '../../utils/format.js';
import { useMockMeetings, getOverview, setStatus } from '../../utils/mockData.js';

// MeetingDetail — status-driven composition (FRONTEND.md §2). What renders below the header
// depends entirely on `meeting.status`, read from the mock store until GET /api/meetings/:id
// (the `overview` aggregate) is live — the branches here already match that response shape.
export default function MeetingDetail() {
  const { id } = useParams();
  const meetings = useMockMeetings(); // subscribes so this page re-renders on any mock mutation
  const meeting = meetings.find((m) => m.id === id);

  if (!meeting) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <EmptyState
          title="Meeting not found"
          description="It may have been deleted, or the link is out of date."
          action={<Button to="/meetings" variant="outline">Back to meetings</Button>}
        />
      </div>
    );
  }

  const statusMeta = STATUS_META[meeting.status] ?? STATUS_META.draft;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <Link to="/meetings" className="flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-on-surface">
        <ArrowLeft size={16} weight="regular" />
        Meetings
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-on-surface sm:text-3xl">{meeting.title}</h1>
            <Badge tone={statusMeta.tone} dot>{statusMeta.label}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
            <span>{formatDate(meeting.meetingDate, { month: 'long' })}</span>
            <span className="flex items-center gap-1.5">
              <UsersThree size={15} weight="regular" />
              {meeting.attendeeCount} attendees
            </span>
            {meeting.durationSeconds > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock size={15} weight="regular" />
                {formatDurationMinutes(meeting.durationSeconds / 60)}
              </span>
            )}
          </div>
        </div>
        {meeting.status === 'completed' && <ExportMenu meetingId={meeting.id} />}
      </header>

      <div className="mt-8">
        {meeting.status === 'draft' && <DraftBody meeting={meeting} />}
        {['uploaded', 'transcribing', 'summarizing', 'failed'].includes(meeting.status) && (
          <ProcessingStatus meetingId={meeting.id} status={meeting.status} errorMessage={meeting.errorMessage} />
        )}
        {meeting.status === 'completed' && <CompletedBody meeting={meeting} />}
      </div>
    </div>
  );
}

function DraftBody({ meeting }) {
  const onUploaded = () => setStatus(meeting.id, 'transcribing');

  return (
    <section className="space-y-6">
      <Dropzone meetingId={meeting.id} onUploaded={onUploaded} />

      <OrDivider />

      <Recorder meetingId={meeting.id} onUploaded={onUploaded} />

      <div className="flex items-center justify-between border-t border-outline-variant/60 pt-4">
        <p className="text-xs text-outline">
          Attach one recording or transcript to start summarizing.
        </p>
        <Link
          to="/meetings"
          className="text-xs text-on-surface-variant underline-offset-2 transition hover:text-error hover:underline"
        >
          Delete draft
        </Link>
      </div>
    </section>
  );
}

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'actions', label: 'Action items' },
  { key: 'speakers', label: 'Speakers' },
];

function CompletedBody({ meeting }) {
  const overview = getOverview(meeting.id);
  const [tab, setTab] = useState('summary');
  const [highlightMs, setHighlightMs] = useState(null);

  if (!overview) {
    return (
      <EmptyState
        title="No summary content for this preview meeting"
        description="This meeting was created in the UI preview, so there's no transcript to summarize yet. Open one of the seeded example meetings from the list to see the full completed view."
        action={<Button to="/meetings" variant="outline">Back to meetings</Button>}
      />
    );
  }

  function jumpToTranscript(ms) {
    setHighlightMs(ms);
    setTab('transcript');
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-outline-variant/60">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'relative px-3 py-2.5 text-sm font-medium transition-colors',
              tab === key ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
            ].join(' ')}
          >
            {label}
            {key === 'actions' && overview.actionItems.some((a) => !a.isDone) && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary-container/60 px-1 text-[10px] text-on-secondary-container">
                {overview.actionItems.filter((a) => !a.isDone).length}
              </span>
            )}
            {tab === key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="animate-fade-in-up py-6" key={tab}>
        {tab === 'summary' && (
          <SummaryView
            overview={overview.summary.overview}
            points={overview.summary.points}
            speakers={overview.speakers}
            onJumpToTranscript={jumpToTranscript}
          />
        )}
        {tab === 'transcript' && (
          <TranscriptView
            segments={overview.transcript.segments}
            speakers={overview.speakers}
            highlightMs={highlightMs}
          />
        )}
        {tab === 'actions' && <ActionItemList meetingId={meeting.id} items={overview.actionItems} />}
        {tab === 'speakers' && <SpeakerLegend meetingId={meeting.id} speakers={overview.speakers} />}
      </div>
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-outline">
      <span className="h-px flex-1 bg-outline-variant/60" />
      or
      <span className="h-px flex-1 bg-outline-variant/60" />
    </div>
  );
}
