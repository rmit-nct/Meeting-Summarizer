import { useState } from 'react';
import Dropzone from '../../components/Dropzone/index.jsx';
import Recorder from '../../components/Recorder/index.jsx';

// MeetingDetail — status-driven composition (FRONTEND.md §2).
// This file currently renders the draft view only. Other views land in
// phase-06 cards. Meeting data is mocked here until the overview endpoint
// exists in phase-06 card #30.
export default function MeetingDetail() {
  const [meeting] = useState({
    id: 'mock-meeting-id',
    title: 'Weekly sync',
    meetingDate: '2026-08-03',
    status: 'draft',
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <a href="/meetings" className="text-sm text-fg-muted transition-colors hover:text-fg">
        ← Meetings
      </a>

      <header className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{meeting.title}</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-warm/15 px-3 py-1 text-xs font-medium text-accent-warm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-warm" />
          Draft
        </span>
      </header>

      <p className="mt-1 text-sm text-fg-muted">
        {new Date(meeting.meetingDate).toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric',
        })}
      </p>

      {meeting.status === 'draft' && (
        <section className="mt-8 space-y-6">
          <Dropzone meetingId={meeting.id} onUploaded={() => {}} />

          <OrDivider />

          <Recorder meetingId={meeting.id} onUploaded={() => {}} />

          <div className="flex items-center justify-between border-t border-fg/10 pt-4">
            <p className="text-xs text-fg-subtle">
              Attach one recording or transcript to start summarizing.
            </p>
            <button
              type="button"
              className="text-xs text-fg-muted underline-offset-2 transition hover:text-danger hover:underline"
            >
              Delete draft
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-fg-subtle">
      <span className="h-px flex-1 bg-fg/10" />
      or
      <span className="h-px flex-1 bg-fg/10" />
    </div>
  );
}
