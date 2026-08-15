# Phase 6 — Detail page + Mutations + History search

## Context Links
- Phase 5 (`completed` meetings exist with points/action-items/speakers)
- `docs/server.doc/ENDPOINTS.md` §2 (`GET /:id` via overview), §3 (`/resummarize`, `/status`), §4 (action-items CRUD), §5 (speakers rename)
- `docs/server.doc/MODELS.md` §5 (`search_meetings` RPC)
- `docs/client.doc/FRONTEND.md` §2-3 (packages)

## Overview
- **Priority:** High — the app is unusable without the detail page and mutations
- **Status:** pending
- **Description:** `overview` aggregator serves `GET /:id`. Client `MeetingDetail` renders all 4 status views. `SummaryView`/`TranscriptView`/`ActionItemList`/`SpeakerLegend` packages implemented. Action-item CRUD + speaker rename endpoints wired. History page gets keyword search + date filter via `search_meetings` RPC. Resummarize endpoint.

## Key Insights
- `overview` module has no model. Composes 4 interface calls. Only place that "knows" all four modules exist.
- Rename a speaker → nothing else changes at the DB level (bullets link via `speaker_id`). Cheap operation.
- Action items are mutable rows the user owns. Resummarize **merges** them (never wipes ticked ones — enforced in Phase 5 via `mergeOnResummarize`).
- Search uses the `search_meetings` Postgres RPC from `MODELS.md` §5. Full-text on `simple` config (not `english`) so Vietnamese isn't mangled.
- No new components in this phase — all packages are already scaffolded in `client/src/components/`, they just need real logic.

## Requirements
- **Functional:** all Core checkboxes except Export tick this phase. Keyword search finds a word appearing in the transcript of a Vietnamese meeting.
- **Non-functional:** every list has loading/empty/error states (`FRONTEND.md` §9). Speaker rename UI updates optimistically then reconciles.

## Architecture
Composition layout:
```
overview.service.detail(meetingId, userId):
  const meeting     = await meeting.interface.getMeetingForOwner(...)
  const transcript  = await transcript.interface.getTranscriptForOwner(...)  // null if not yet
  const summary     = await summary.interface.getSummaryForOwner(...)         // null if not yet
  const actionItems = await actionItem.interface.listByMeeting(...)
  const speakers    = await speaker.repository.listByMeeting(...)             // read-only
  return { meeting, transcript, summary, actionItems, speakers }
```

Detail view state machine (from `FRONTEND.md`):
| status | shows |
|---|---|
| draft | Dropzone + Recorder |
| uploaded → summarizing | ProcessingStatus (poller) |
| completed | SummaryView + TranscriptView + ActionItemList + SpeakerLegend + ExportMenu |
| failed | error + Retry button (POST /:id/process) |

## Related Code Files
Fill:
- `server/src/modules/overview/overview.service.js`, `.controller.js`, `.routes.js` uncomment
- `server/src/modules/action-item/action-item.controller.js`, `.validator.js`, `.dto.js`, `.routes.js` uncomment
- `server/src/modules/summary/summary.controller.js` — `renameSpeakers`
- `server/src/modules/summary/summary.validator.js` — rename payload schema
- `server/src/modules/summary/summary.routes.js` — uncomment PATCH /:id/speakers
- `server/src/modules/processing/processing.controller.js` — add `resummarize`
- `server/src/modules/processing/processing.service.js` — `resummarize(meetingId, userId)` — asserts transcript exists, flips status to `summarizing`, publishes an internal `resummarize:requested` that only `summary.service` listens for (or just calls `summary.service.run` directly through its interface — pick one, prefer interface call for simplicity)
- `server/src/modules/meeting/meeting.repository.js` — add `searchMeetings(userId, {q, from, to, status}, page, limit)` calling `supabase.rpc('search_meetings', ...)`; add `countMeetings(...)` companion
- `server/src/modules/meeting/meeting.controller.js` — `list` gets the new query params
- `server/supabase/migrations/20260810000004_search_rpc.sql` — `search_meetings` + `count_meetings` functions per `MODELS.md` §5

Client — fill component packages (already scaffolded):
- `SummaryView/` — bullets grouped by category, category filter chips, speaker filter chips, click to jump-to-timestamp
- `TranscriptView/` — segment list with `[mm:ss] Speaker N: text`; highlight on jump-to (target of SummaryView clicks); simple search box for in-transcript find
- `ActionItemList/` — checkbox + inline edit for content/ownerLabel/dueDate + add row + delete
- `SpeakerLegend/` — displays `displayName || label`; edit → PATCH /:id/speakers with the whole array (bulk rename per `ENDPOINTS.md` §5)
- `MeetingList/` — history rows, keyword box (debounced), date range inputs, pagination controls
- `ProcessingStatus/` — extend from Phase 4: add Retry button on `failed` status; add Resummarize action (only visible on `completed`) that hits `POST /:id/resummarize`
- `MeetingDetail.jsx` — status-based composition (all 4 views)
- `MeetingHistory.jsx` — real search + date filter, replaces the placeholder list

## Implementation Steps

1. **`search_meetings` migration** — copy from `MODELS.md` §5 verbatim. Also `count_meetings` for `meta.total`. Grant execute to `authenticated` role.
2. **`meeting.repository.searchMeetings`** — `supabase.rpc('search_meetings', { p_user_id, p_q, p_from, p_to, p_limit, p_offset })`. Companion `countMeetings` for pagination `total`.
3. **`meeting.controller.list`** — accept `q, from, to, status, page, limit` from validated `req.query`. Pass to repo. Return envelope with `meta.paginate(...)`.
4. **`overview.service.detail`** — composed as above. `overview.controller.detail` returns the envelope. `overview.routes.js` mounted at `/api/meetings`, uncomment `GET /:id`.
5. **`action-item` module** — CRUD per `ENDPOINTS.md` §4. Validator: create requires `meetingId + content`; update accepts any of `content, ownerLabel, dueDate, isDone, orderIndex`. Repo methods scoped by `userId`.
6. **Speaker rename** — `PATCH /api/meetings/:id/speakers` with `{ speakers: [{id, displayName, color}] }`. Validator: array bounded (max 20). Service: assert every `speakers[i].id` belongs to this meeting + user (single WHERE clause). Update in one batch. No LLM call.
7. **Resummarize** — `POST /:id/resummarize`. Assert `transcripts` row exists (else `invalidState`). Flip status → `summarizing`. Call `summary.service.run` (which will overwrite `summaries`/`summary_points`/re-publish `summary:action-items-extracted` → `action-item.mergeOnResummarize`).
8. **Client `overview` fetch** — `meetingDetail.service.js` calls `GET /:id`, returns everything. `MeetingDetail.jsx` reads status → renders the right view.
9. **`SummaryView`** — bullets grouped by category (visual + accessible labels — `FRONTEND.md` §8 says "never colour alone"). Filter chips for category and speaker. Click a bullet → callback with `startMs` → passes to `TranscriptView` for jump-highlight.
10. **`TranscriptView`** — flat segment list. Received `startMs` → scroll into view + highlight. Simple in-page find (client-side substring match over rendered text).
11. **`ActionItemList`** — checkbox is `PATCH /api/action-items/:id { isDone }`. Optimistic update in the store, revert on failure. Add row → `POST`. Delete → `DELETE`.
12. **`SpeakerLegend`** — bulk rename. One `PATCH` per save (batch the whole array). Names show up in `SummaryView` chips + `TranscriptView` speaker prefixes.
13. **`MeetingList`** (history) — search box debounced (300 ms). Date pickers. Pagination. Sends `q, from, to, page, limit` to `GET /api/meetings`.
14. **Loading/empty/error** — every list (history, action items, points, speakers, transcript) has three states. `FRONTEND.md` §9. A blank screen on failure looks like a broken app.
15. **Smoke tests:**
    - Two-user isolation on `/api/meetings?q=foo` — B doesn't see A's matches
    - Renaming Speaker 1 → "Minh" updates chips in `SummaryView` after refetch
    - Ticking an action item persists across refresh
    - Search "budget" finds a completed Vietnamese meeting whose transcript mentions it (via full-text `simple` config)
    - Resummarize after speaker rename regenerates bullets referencing "Minh" not "Speaker 1"; already-ticked action items keep their tick

## Todo List
- [ ] `search_meetings` + `count_meetings` migration
- [ ] `meeting.repository` search + count + controller wiring
- [ ] `overview` service + controller + route
- [ ] `action-item` controller + validator + dto + routes
- [ ] `summary.controller.renameSpeakers` + validator + route
- [ ] `processing.service.resummarize` + controller + route
- [ ] Client `SummaryView`, `TranscriptView`, `ActionItemList`, `SpeakerLegend`, `MeetingList`, `MeetingDetail` real logic
- [ ] Loading/empty/error states across the board
- [ ] Smoke tests pass
- [ ] Commit sequence per module

## Success Criteria
- Complete user story works end-to-end for both audio and text uploads
- Search finds Vietnamese words correctly (tsvector `simple` config)
- Two-user isolation intact
- Action-item ticks survive resummarize
- Rename speaker → subsequent resummarize produces bullets using the new name (LLM sees it in the input prompt as a legend)

## Risk Assessment
- **Risk:** `search_meetings` RPC crosses module boundaries (joins `transcripts`, `summaries` from `meeting` repo). **Accepted** — this is the one exception documented in `MODELS.md` §5, contained inside a DB function rather than JS code
- **Risk:** optimistic action-item ticking desyncs on race. **Mitigation:** if the PATCH fails, revert local state AND show a toast; no silent failures.
- **Risk:** re-fetching the whole overview on every mutation is wasteful. **Mitigation:** accept for MVP — pages are small. Optimize with local state updates if slowness measured (YAGNI otherwise).

## Security Considerations
- Speaker rename endpoint: must reject `speakers[i].id` not belonging to `req.user`. Validator can't check ownership (async DB call needed) — enforce in service, single WHERE clause, count-of-updated-rows === payload length else `forbidden`
- Search query goes into `plainto_tsquery('simple', p_q)` — the RPC parametrizes; no injection risk

## Next Steps
- Phase 7 wires exports (MD + PDF)
- Phase 8 deploys and produces submission artifacts
