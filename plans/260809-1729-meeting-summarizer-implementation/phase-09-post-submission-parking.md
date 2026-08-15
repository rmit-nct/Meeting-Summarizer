# Phase 9 — Post-submission parking (live-session + DOCX)

## Context Links
- Brainstorm §2 (deferred features), §6 (risks — live-session is scope creep)
- `docs/system.doc/ARCHITECTURE.md` §3.3 (transient state — the design is already documented; only unbuilt)
- Existing scaffold files under `server/src/modules/live-session/`

## Overview
- **Priority:** Nice-to-have — **DO NOT START before Phase 8 finishes cleanly**
- **Status:** unstarted (parking lot)
- **Description:** Two independent features that were explicitly deferred: (a) live-summarization during an ongoing meeting via WebSocket, per `ARCHITECTURE.md` §3.3; (b) DOCX export as a third format alongside MD + PDF.

## Key Insights
- Live-session is the docs' "stretch" feature. Scaffold files exist (`live-session.socket.js`, `live-session.sweeper.js`). Nothing is wired.
- DOCX is scope creep against the brief (which requires only MD + PDF). Only worth doing if a real user has asked.
- Both are independent — pick either or neither. Neither blocks the other.

## Requirements
For live-session (if attempted):
- Real-time recording via browser MediaRecorder → chunked upload over WebSocket
- Rolling summary refreshed every N chunks (configurable)
- Materialize into a durable `Meeting`/`Transcript`/`Summary` on `live:end`
- Sweeper handles orphaned sessions past `expires_at`

For DOCX (if attempted):
- Third format alongside MD + PDF
- Vietnamese characters render correctly
- Tables (action items) format properly

## Architecture
Live-session — already documented in `ARCHITECTURE.md` §3.3, `ENDPOINTS.md` §8. Nothing to design; only to build.

DOCX — mirrors `export.pdf.js` but uses `docx` npm library. Same input contract.

## Related Code Files
Live-session:
- `server/src/config/socket.js` — currently minimal; add auth handshake verification
- `server/src/index.js` — uncomment socket registration
- `server/src/modules/live-session/live-session.socket.js` — real handlers
- `server/src/modules/live-session/live-session.service.js` — chunk handling + materialize
- `server/src/modules/live-session/live-session.sweeper.js` — periodic cleanup
- `server/src/modules/live-session/live-session.repository.js` + interface
- `client/src/components/LiveSessionPanel/*` — real
- `client/src/pages/authenticated/LiveSession.jsx` — real
- `client/src/stores/socket.store.js` — real Socket.IO connection

DOCX:
- `server/src/modules/export/export.docx.js` — new renderer
- `server/src/modules/export/export.service.js` — dispatch on `format==='docx'`
- `server/src/modules/export/export.controller.js` — accept `format=docx`
- `server/package.json` — `npm install docx`
- `client/src/components/ExportMenu/*` — third link
- `docs/server.doc/ENDPOINTS.md` §6 — mention DOCX
- `docs/submission.doc/DELIVERABLES.md` — bump extras

## Implementation Steps

**Live-session (if attempted):**
1. Update `docs/` to un-defer live-session (reverses Phase 1 edit)
2. Wire Socket.IO with Supabase JWT verification on handshake
3. Implement `live-session.socket.js` handlers per `ENDPOINTS.md` §8
4. Implement chunk-append + rolling summary refresh cadence
5. Implement materialization on `live:end` — calls existing `meeting`/`transcript`/`summary` interfaces
6. Sweeper: `setInterval(60_000, ...)` marks expired sessions, materializes what exists
7. `LiveSessionPanel` on client — MediaRecorder → chunks → socket emit
8. Test dropped-connection resilience — chunks should not silently disappear

**DOCX (if attempted):**
1. `npm install docx`
2. `export.docx.js` — build a `Document` with paragraphs, headings, table (action items)
3. Embed Vietnamese font in the document (docx library supports font references)
4. Wire route + controller + client link
5. Verify diacritics render in Word

## Todo List
Live-session:
- [ ] (parked)

DOCX:
- [ ] (parked)

## Success Criteria
n/a — this phase may never be started.

## Risk Assessment
- **Risk:** starting live-session before Phase 8 is bulletproof risks losing the submission. **Mitigation:** blocked-by dependency on Phase 8; don't touch until then.
- **Risk:** DOCX adds a maintenance burden for a non-required feature. **Mitigation:** ship only if strong signal from evaluators or club leadership.

## Security Considerations
- Live-session socket auth: `authenticate.js` middleware equivalent for Socket.IO — verify token in handshake, close socket if invalid
- Chunk uploads: enforce same MIME/size checks as REST upload

## Next Steps
None until submission successful.
