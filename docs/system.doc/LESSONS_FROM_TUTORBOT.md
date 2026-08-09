# LESSONS_FROM_TUTORBOT.md

The predecessor project ("TutorBot" / EduAssist) solved a structurally similar problem:
upload media → stage it in object storage → async transcription → LLM analysis returning a
JSON summary + action items → typed frontend client.

That pipeline shape is proven and is carried over. Most implementation details around it are
not. This file records both, so the same bugs are not paid for twice.

---

## 1. Patterns worth reusing

| Pattern from TutorBot | How it maps here |
| --- | --- |
| **Stage the file in object storage first, then transcribe** (NCP Object Storage → Clova Speech) | Supabase Storage → Groq Whisper. Media never passes through the API. |
| **Async processing with a client-visible status** (`/api/lectures/status`) | The `meeting.status` state machine, pushed over WebSocket with `GET /:id/status` as fallback. Same idea, better transport. |
| **LLM returns JSON with `summary` + `action_items`, defensively extracted from markdown fences** | Exactly the contract in `AI_INTEGRATION.md` §3. Keep the defensive extraction — Groq JSON mode helps but does not remove the need. |
| **A single typed client module wrapping backend calls** (`lib/api.ts`, `API_ENDPOINTS`) | `client/src/config/endpoints.js` + `utils/http.js`, consumed by component-scoped services. Kept and made mandatory. |
| **Action items as first-class rows with their own CRUD** | Kept. Users tick them off; they cannot live inside a JSON blob. |
| **A search endpoint over the content records** | `GET /api/meetings?q=&from=&to=`, upgraded to real Postgres full-text search. |

---

## 2. Concrete mistakes not to repeat

Each is a real, named problem from the predecessor repo, paired with the rule that prevents
it here.

### Hardcoded hosts in source
`config.ts`'s `apiUrl` was hardcoded to a remote nip.io host instead of reading
`NEXT_PUBLIC_API_URL` — which existed in `.env.local` but was never actually read. The
Google OAuth redirect URI was likewise hardcoded in `auth.py`, contradicting its own setup doc.

**Rule:** every URL comes from `config/env.js` on the relevant side; every backend path comes
from `client/src/config/endpoints.js`. `grep -rn "https://" client/src server/src` should
surface no application host.

### Stale documentation shipped alongside the code
`AUTH_README.md` and `API_INTEGRATION_STATUS.md` described endpoints (`/api/register`,
`/api/login`, `/api/start_session`) that no longer existed. New contributors had to be told
"do not trust the docs."

**Rule:** an endpoint or socket-event change and its `ENDPOINTS.md` edit are one commit. If a
doc becomes untrue and you cannot fix it now, delete it.

### No migrations
Tables were auto-created by `Base.metadata.create_all` at startup. Schema changes were
invisible in git and unreproducible.

**Rule:** every schema change is a file in `server/supabase/migrations/`.

### Two nested git repositories
`tutor-bot/.git` inside the outer `TutorBot` repo, so contributors had to check which repo
they were committing to.

**Rule:** one repo, `client/` and `server/` side by side.

### A dependency file that lied
`requirements.txt` listed `fastapi` and `uvicorn` for an app that ran Flask.

**Rule:** each `package.json` contains only what is imported. Run a depcheck before submission.

### Ad-hoc fetch calls bypassing the API client
`lib/api.ts` existed, but most pages hand-rolled `fetch` with `getAuthHeaders()` /
`handleAuthError()`, so 401 handling was duplicated and inconsistent.

**Rule:** no `fetch` outside `utils/http.js`. Network calls live in a component package's
`*.service.js`. One centralized 401 handler.

### Dead code presented as live
An elaborate `components/socratic/*` UI kit sat unused while the app rendered the `simple/`
variants — nobody could tell what was real without reading imports.

**Rule:** delete unused components. Git remembers them. Package-based componentization makes
a dead component a dead *folder*, which is easy to spot and easy to remove.

### God components
`src/app/page.tsx` was one client component holding the sidebar, session list, drag-and-drop
upload, and the chat pane.

**Rule:** the component package structure enforces the split — JSX in `index.jsx`, logic in
the hook, network in the service. If a hook passes ~150 lines, the component is doing too
much. `NewMeeting` is the page most at risk of becoming this.

### Two parallel systems that shared nothing
`GeneralChatSession` and `SocraticChatSession` were separate table sets disambiguated by a
`?mode=` query param — double the schema, double the routes, no shared behaviour.

**Rule:** if two features need different tables *and* different endpoints, they are different
features. Ship one properly. Note the contrast with `LiveSession` here: it is a *transient
projection* of the same durable records, materialized into them, not a parallel universe.

### Hand-mirrored schemas
Pydantic schemas manually mirrored the SQLAlchemy models with no shared codegen; they drifted.

**Rule:** one Zod schema per boundary, in the module's `*.validator.js`. One serialization
transform in `shared/dto.js`. Never hand-map a field that a shared transform already handles.

### Layers that leaked
Routes reached models, `get_db()` existed but was not wired into the request lifecycle so
every route opened and closed its own session by hand.

**Rule:** `Route/Socket → Controller → Service → Repository/Interface → Model`, one
direction, no exceptions. Connection handling lives in `config/database.js`, not in route code.

### No tests at all
`test_storage.py` / `test_upload.txt` were ad-hoc scripts, not a suite.

**Rule:** full coverage is not expected on a club project, but write unit tests for the two
things that will break silently — the **LLM JSON parser/normalizer** and the **Markdown
export builder**. Both are pure functions and both are load-bearing.

---

## 3. Explicitly dropped from TutorBot

Not in the NCT brief. Do not port these, and do not let them creep back in:

- Socratic tutoring / quiz flow, and the general chat surface
- Chat sessions and message history of any kind
- Classes → Lectures hierarchy (a meeting here is a flat, standalone record)
- The calendar/scheduling feature with its own local data model and ICS export
- Per-action-item notebook pages
- Custom JWT auth, bcrypt, and hand-wired Google OAuth — Supabase Auth replaces all of it
- Flask, SQLAlchemy, MySQL, `docker-compose.yml`, nginx reverse-proxy config

Dropping the entire auth layer and swapping the backend framework is not a loss. It removes
roughly half the surface area of the old project along with every bug that lived there.

---

## 4. One line

**Keep the pipeline. Rebuild the plumbing, and keep the layers honest.**
