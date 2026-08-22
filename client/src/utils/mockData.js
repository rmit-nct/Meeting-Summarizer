import { useSyncExternalStore } from 'react';

// In-memory mock "backend" for the UI-only build. NOT a fourth global store (FRONTEND.md §6
// caps stores/ at three) — this is scaffolding that goes away once GET/POST /api/meetings and
// the /rt socket are live; every function here maps 1:1 to a real ENDPOINTS.md call, listed in
// the comment above each one, so wiring the real API later means swapping the function body,
// not the call sites in pages/components.
//
// State resets on page reload by design — there is no persistence layer here.

let meetings = seed();
const listeners = new Set();

function notify() {
  meetings = [...meetings];
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return meetings;
}

/** Real: GET /api/meetings */
export function useMockMeetings() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Real: GET /api/meetings/:id (the `meeting` slice of the overview aggregate) */
export function getMeetingById(id) {
  return meetings.find((m) => m.id === id) ?? null;
}

/** Real: POST /api/meetings */
export function createDraftMeeting({ title, meetingDate }) {
  const meeting = {
    id: `mtg-${Date.now()}`,
    title: title.trim(),
    description: '',
    status: 'draft',
    meetingDate: meetingDate || new Date().toISOString().slice(0, 10),
    durationSeconds: 0,
    actionItemCount: 0,
    createdAt: new Date().toISOString(),
    attendeeCount: 1,
    tags: [],
  };
  meetings = [meeting, ...meetings];
  notify();
  return meeting;
}

/** Real: response of POST /api/meetings/:id/upload */
export function markUploaded(id) {
  patchMeeting(id, { status: 'uploaded' });
}

/** Real: driven by `meeting:progress` / `meeting:completed` / `meeting:failed` over the socket */
export function setStatus(id, status, extra = {}) {
  patchMeeting(id, { status, ...extra });
}

function patchMeeting(id, patch) {
  meetings = meetings.map((m) => (m.id === id ? { ...m, ...patch } : m));
  notify();
}

/** Real: PATCH /api/action-items/:id */
export function toggleActionItem(meetingId, itemId) {
  updateActionItem(meetingId, itemId, (item) => ({ isDone: !item.isDone }));
}

/** Real: PATCH /api/action-items/:id */
export function updateActionItem(meetingId, itemId, patchOrFn) {
  const overview = overviewByMeetingId[meetingId];
  if (!overview) return;
  overview.actionItems = overview.actionItems.map((item) => {
    if (item.id !== itemId) return item;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(item) : patchOrFn;
    return { ...item, ...patch };
  });
  notify();
}

/** Real: POST /api/action-items */
export function addActionItem(meetingId, { content, ownerLabel, dueDate }) {
  const overview = overviewByMeetingId[meetingId];
  if (!overview) return;
  overview.actionItems = [
    ...overview.actionItems,
    { id: `ai-${Date.now()}`, content, ownerLabel: ownerLabel ?? '', dueDate: dueDate ?? '', isDone: false },
  ];
  patchMeeting(meetingId, { actionItemCount: overview.actionItems.length });
}

/** Real: DELETE /api/action-items/:id */
export function deleteActionItem(meetingId, itemId) {
  const overview = overviewByMeetingId[meetingId];
  if (!overview) return;
  overview.actionItems = overview.actionItems.filter((item) => item.id !== itemId);
  patchMeeting(meetingId, { actionItemCount: overview.actionItems.length });
}

/** Real: PATCH /api/meetings/:id/speakers */
export function renameSpeaker(meetingId, speakerId, displayName) {
  const overview = overviewByMeetingId[meetingId];
  if (!overview) return;
  overview.speakers = overview.speakers.map((s) => (s.id === speakerId ? { ...s, displayName } : s));
  overview.summary.points = overview.summary.points.map((p) =>
    p.speaker?.id === speakerId ? { ...p, speaker: { ...p.speaker, displayName } } : p,
  );
  notify();
}

/** Real: the `transcript` + `summary` + `actionItems` + `speakers` slices of GET /api/meetings/:id */
export function getOverview(meetingId) {
  return overviewByMeetingId[meetingId] ?? null;
}

// ---------------------------------------------------------------------------------------------

function seed() {
  return [
    {
      id: 'mtg-roadmap',
      title: 'Q3 Product Roadmap Review & Strategy Sync',
      description: '',
      status: 'completed',
      meetingDate: '2026-08-10',
      durationSeconds: 5400,
      actionItemCount: 3,
      createdAt: '2026-08-10T10:00:00.000Z',
      attendeeCount: 5,
      tags: ['Marketing'],
    },
    {
      id: 'mtg-eng-sync',
      title: 'Weekly Engineering Sync',
      description: '',
      status: 'completed',
      meetingDate: '2026-08-12',
      durationSeconds: 1800,
      actionItemCount: 2,
      createdAt: '2026-08-12T09:00:00.000Z',
      attendeeCount: 4,
      tags: ['Engineering'],
    },
    {
      id: 'mtg-onboarding',
      title: 'Design Review: Onboarding Flow',
      description: '',
      status: 'transcribing',
      meetingDate: '2026-08-14',
      durationSeconds: 2100,
      actionItemCount: 0,
      createdAt: '2026-08-14T14:00:00.000Z',
      attendeeCount: 3,
      tags: ['Design'],
    },
    {
      id: 'mtg-client-call',
      title: 'Client Discovery Call — Riverside Retail',
      description: '',
      status: 'failed',
      meetingDate: '2026-08-11',
      durationSeconds: 0,
      actionItemCount: 0,
      createdAt: '2026-08-11T15:30:00.000Z',
      attendeeCount: 2,
      tags: ['Client Call'],
      errorMessage: "Transcription failed: the uploaded audio file appears to be corrupted.",
    },
    {
      id: 'mtg-1-1',
      title: '1:1 — Minh & Linh',
      description: '',
      status: 'draft',
      meetingDate: '2026-08-15',
      durationSeconds: 0,
      actionItemCount: 0,
      createdAt: '2026-08-15T08:00:00.000Z',
      attendeeCount: 2,
      tags: [],
    },
  ];
}

const overviewByMeetingId = {
  'mtg-roadmap': {
    transcript: {
      language: 'en',
      fullText: '',
      segments: [
        { id: 'seg-1', startMs: 15000, endMs: 42000, speakerId: 'spk-minh', text: "Let's start with the AI analytics module. Where are we on the integration timeline?" },
        { id: 'seg-2', startMs: 42000, endMs: 95000, speakerId: 'spk-sarah', text: 'Engineering is on track for August 12th. The onboarding flow revamp is the bigger risk — we are about two weeks behind on the mobile side.' },
        { id: 'seg-3', startMs: 95000, endMs: 140000, speakerId: 'spk-michael', text: "If mobile is behind, I'd rather we ship core stability in Q3 and hold feature parity for Q4 than rush it." },
        { id: 'seg-4', startMs: 140000, endMs: 210000, speakerId: 'spk-minh', text: 'Agreed. Let\'s approve budget for two freelance developers to help close the gap without slipping the core roadmap.' },
      ],
    },
    summary: {
      overview:
        'The team finalized the Q3 product roadmap, focusing primarily on the integration of the new AI-driven analytics module and revamping the user onboarding flow. Marketing aligned on a staggered launch strategy, beginning early August, to capitalize on back-to-school trends.\n\nA significant portion of the discussion revolved around resource allocation, specifically regarding engineering bandwidth for the mobile application updates, which are currently running two weeks behind schedule.',
      points: [
        {
          id: 'pt-1',
          content: 'Launch date for the AI Analytics module is confirmed for August 12th.',
          category: 'decision',
          speaker: { id: 'spk-minh', label: 'Speaker 1', displayName: 'Minh Tran' },
          startMs: 15000,
          orderIndex: 0,
        },
        {
          id: 'pt-2',
          content: 'Mobile app feature parity is delayed; focus will shift to core stability before adding new features in Q4.',
          category: 'risk',
          speaker: { id: 'spk-sarah', label: 'Speaker 2', displayName: 'Sarah Nguyen' },
          startMs: 42000,
          orderIndex: 1,
        },
        {
          id: 'pt-3',
          content: 'Budget approved for two additional freelance frontend developers to assist with the onboarding revamp.',
          category: 'decision',
          speaker: { id: 'spk-minh', label: 'Speaker 1', displayName: 'Minh Tran' },
          startMs: 140000,
          orderIndex: 2,
        },
      ],
    },
    actionItems: [
      { id: 'ai-1', content: 'Draft launch comms plan by end of week.', ownerLabel: 'Sarah Nguyen', dueDate: '2026-08-14', isDone: false },
      { id: 'ai-2', content: 'Finalize freelance developer contracts.', ownerLabel: 'Michael Tran', dueDate: '2026-08-15', isDone: false },
      { id: 'ai-3', content: 'Update the Jira epic with the revised mobile timeline.', ownerLabel: 'Alex Pham', dueDate: '2026-08-13', isDone: true },
    ],
    speakers: [
      { id: 'spk-minh', label: 'Speaker 1', displayName: 'Minh Tran', color: '#00657a' },
      { id: 'spk-sarah', label: 'Speaker 2', displayName: 'Sarah Nguyen', color: '#815600' },
      { id: 'spk-michael', label: 'Speaker 3', displayName: 'Michael Tran', color: '#555c6a' },
    ],
  },

  'mtg-eng-sync': {
    transcript: {
      language: 'en',
      fullText: '',
      segments: [
        { id: 'seg-1', startMs: 5000, endMs: 38000, speakerId: 'spk-hoa', text: 'Transcript service is fully wired to Groq Whisper now, and processing is handling retries cleanly.' },
        { id: 'seg-2', startMs: 38000, endMs: 80000, speakerId: 'spk-david', text: 'Nice. On my side, the export renderer for PDF is still dropping Vietnamese diacritics — need to embed a proper font.' },
      ],
    },
    summary: {
      overview: 'Transcript and processing modules are confirmed stable. The PDF export renderer needs a font fix to preserve Vietnamese diacritics before it ships.',
      points: [
        {
          id: 'pt-1',
          content: 'Transcript and processing modules are stable in staging; retries handled cleanly.',
          category: 'decision',
          speaker: { id: 'spk-hoa', label: 'Speaker 1', displayName: 'Hoa Le' },
          startMs: 5000,
          orderIndex: 0,
        },
        {
          id: 'pt-2',
          content: 'PDF export currently drops Vietnamese diacritics — blocking before release.',
          category: 'blocker',
          speaker: { id: 'spk-david', label: 'Speaker 2', displayName: 'David Kim' },
          startMs: 38000,
          orderIndex: 1,
        },
      ],
    },
    actionItems: [
      { id: 'ai-1', content: 'Embed Be Vietnam Pro in the PDF export renderer.', ownerLabel: 'David Kim', dueDate: '2026-08-16', isDone: false },
      { id: 'ai-2', content: 'Add a regression test covering diacritic-heavy transcripts.', ownerLabel: 'Hoa Le', dueDate: '2026-08-18', isDone: false },
    ],
    speakers: [
      { id: 'spk-hoa', label: 'Speaker 1', displayName: 'Hoa Le', color: '#00657a' },
      { id: 'spk-david', label: 'Speaker 2', displayName: 'David Kim', color: '#815600' },
    ],
  },

  'mtg-onboarding': {
    transcript: {
      language: 'en',
      fullText: '',
      segments: [
        { id: 'seg-1', startMs: 8000, endMs: 46000, speakerId: 'spk-linh', text: 'The new onboarding flow cuts setup from five steps to three. First-run testing looked good this week.' },
        { id: 'seg-2', startMs: 46000, endMs: 90000, speakerId: 'spk-minh', text: 'One open question: do we still need the tour tooltip on step two, or does the empty state explain it well enough on its own?' },
      ],
    },
    summary: {
      overview: 'The redesigned onboarding flow reduces setup from five steps to three, and early usability testing looked positive. The team still needs to decide whether the guided tour tooltip on step two is necessary now that the empty state carries more explanatory copy.',
      points: [
        {
          id: 'pt-1',
          content: 'Onboarding flow reduced from five steps to three; usability testing this week was positive.',
          category: 'decision',
          speaker: { id: 'spk-linh', label: 'Speaker 1', displayName: 'Linh Pham' },
          startMs: 8000,
          orderIndex: 0,
        },
        {
          id: 'pt-2',
          content: 'Undecided whether the step-two tour tooltip is still needed alongside the new empty-state copy.',
          category: 'question',
          speaker: { id: 'spk-minh', label: 'Speaker 2', displayName: 'Minh Tran' },
          startMs: 46000,
          orderIndex: 1,
        },
      ],
    },
    actionItems: [
      { id: 'ai-1', content: 'A/B test the step-two tooltip against the empty-state-only version.', ownerLabel: 'Linh Pham', dueDate: '2026-08-20', isDone: false },
    ],
    speakers: [
      { id: 'spk-linh', label: 'Speaker 1', displayName: 'Linh Pham', color: '#00657a' },
      { id: 'spk-minh', label: 'Speaker 2', displayName: 'Minh Tran', color: '#815600' },
    ],
  },
};
