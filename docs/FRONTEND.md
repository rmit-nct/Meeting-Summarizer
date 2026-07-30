# FRONTEND.md

`client/` — React SPA. Layer rules and component packages come from `ARCHITECTURE.md` §5;
this file is the concrete build.

---

## 1. Layers, restated

```
Pages  →  Components  →  Hooks / Services  →  Global Stores / Utils
```

Dependency direction is one-way. A store never imports a component. A component never
imports a page. `config/` and `utils/` are outside the tiers and may be used by any layer.

---

## 2. Pages and routing

| Path | Page | Tier |
| --- | --- | --- |
| `/` | `Landing` | public |
| `/login` | `Login` | public |
| `/signup` | `Signup` | public |
| `/auth/callback` | `AuthCallback` | public |
| `/meetings` | `MeetingHistory` | authenticated |
| `/meetings/new` | `NewMeeting` | authenticated |
| `/meetings/:id` | `MeetingDetail` | authenticated |
| `/live` | `LiveSession` *(stretch)* | authenticated |
| `/settings` | `Settings` | authenticated |

- `routes/routeTable.js` is the single map of path → page → tier. Adding a page means
  adding a row here, not scattering `<Route>` elements.
- `routes/RouteGuard.jsx` enforces the tier before render: `public` bounces signed-in users
  away from Login/Signup; `authenticated` bounces everyone else to `/login`.
- **The guard is UX, not security.** Every rule it enforces is enforced again by
  `middleware/authorize.js` on the server.

Pages are composition roots only: assemble components, read stores, pass props. A page
containing an API call or business logic is a layering violation.

---

## 3. Component packages

Each component is a package, not a file:

```
ProcessingStatus/
├── index.jsx                        # JSX only
├── sub-components/
│   ├── StatusStepper.jsx
│   └── FailureNotice.jsx
├── useProcessingStatus.hook.js      # logic: socket subscription + polling fallback
├── processingStatus.service.js      # API calls scoped to this component
└── ProcessingStatus.css
```

Rules:
- Exposed to the rest of the app **only** through `index.jsx`.
- `index.jsx` contains no `fetch`, no business logic — it renders what the hook returns.
- The hook contains no JSX.
- `*.service.js` uses `utils/http.js` and paths from `config/endpoints.js`. It never
  hardcodes a URL.
- If a package's hook exceeds ~150 lines, the component is doing too much — split it.

### The packages

| Package | Responsibility |
| --- | --- |
| `Dropzone` | Drag-and-drop + file picker. Validates MIME/size client-side against `utils/constants.js` — the same values the server enforces. |
| `Recorder` | In-browser recording. See §4. |
| `UploadProgress` | Byte progress of the direct-to-Storage upload. |
| `ProcessingStatus` | The pipeline stepper. See §5. |
| `MeetingList` | History rows, keyword box, date range, pagination. |
| `SummaryView` | Bullets grouped by category + filter chips + speaker chips + jump-to-timestamp. |
| `TranscriptView` | Segment list with timestamps and in-page highlight. |
| `ActionItemList` | Checkbox, inline edit of content/owner/due date, add, delete. |
| `SpeakerLegend` | Rename inferred speakers; the thing that makes speaker attribution usable. |
| `ExportMenu` | Markdown and PDF download links. |
| `LiveSessionPanel` | *(stretch)* live transcript feed + rolling summary. |

---

## 4. `Recorder`

- `getUserMedia({ audio: true })`. Handle permission denial with a visible message, not a
  console error — a dead Record button during a demo looks like a broken app.
- Record to `audio/webm;codecs=opus`. Check `MediaRecorder.isTypeSupported` and fall back.
- Show elapsed time and a live level meter so the user can see it is working.
- On stop, produce a `Blob` and hand it to **the same upload path the Dropzone uses**.
  One upload flow, two entry points.
- No client-side transcoding. The server has ffmpeg (`AI_INTEGRATION.md` §2); the browser
  does not need to do this work.

---

## 5. `ProcessingStatus` and the dual transport

This package is where the protocol split becomes visible in the UI.

```js
// Primary: subscribe to pipeline events for this meeting.
// Fallback: if the socket is down, poll GET /api/meetings/:id/status every 3s.
// Both paths write the same state, because both describe the same state machine.
```

- On mount: `socket.emit('meeting:subscribe', { meetingId })`.
- Listen for `meeting:progress`, `meeting:completed`, `meeting:failed`.
- If `socketStore.connected === false`, start the 3 s poll; stop it the moment the socket
  reconnects.
- On unmount: `meeting:unsubscribe`, clear the interval. Both, always.
- Stop everything on `completed` (navigate to the detail page) or `failed` (show
  `errorMessage` + a Retry button wired to `POST /:id/process` or `/resummarize`).
- Hard timeout at 10 minutes with a clear message rather than an infinite spinner.

Render from `status`, never from "did a request come back yet". The two transports must be
indistinguishable to the user.

---

## 6. Global stores

`stores/` holds cross-cutting state only. Three of them, no more:

| Store | Holds |
| --- | --- |
| `auth.store.js` | Supabase session, current user, `signIn` / `signUp` / `signOut`. The only place that talks to the Supabase auth client. |
| `socket.store.js` | The one socket connection for the whole app: created after authentication, torn down on sign-out, exposes `connected`. **Components never construct a socket.** |
| `ui.store.js` | Theme, toasts, global modals. |

`hooks/useSocketEvent(event, handler)` subscribes and unsubscribes with the component
lifecycle so no package manages listeners by hand.

If something is used by one component, it belongs in that component's hook — not in a store.

---

## 7. Config and utils

```
config/
├── endpoints.js     # single source of truth for backend paths (ENDPOINTS.md §9)
└── env.js           # validated import.meta.env access; throws at boot if a var is missing
utils/
├── http.js          # bearer token, envelope unwrapping, typed errors, ONE 401 handler
├── supabase.js      # browser Supabase client (anon key only)
├── constants.js     # MIME allowlist, size limit, category colours, status→step labels
└── format.js        # duration, date, timestamp helpers
```

`utils/http.js` is the only module that knows the envelope shape:

```js
// Unwrap { success, data, meta } once, here, so no component ever sees the envelope.
// A 401 signs the user out and redirects — centrally, never per-component.
```

**Never hardcode a backend URL.** `env.js` reads `VITE_API_URL` and `VITE_SOCKET_URL`.
This was a real bug in the predecessor project (`LESSONS_FROM_TUTORBOT.md`).

---

## 8. Styling

- Co-located `ComponentName.css` per package, per the componentization rule.
- `styles/tokens.css` holds design tokens (colour, spacing, radius, type scale) as CSS
  custom properties. Packages consume tokens; they do not define their own palette.
- Category colours, defined once in `constants.js` + tokens: decision green, action blue,
  question amber, blocker red, risk orange, discussion grey. **Never colour alone** —
  always pair with the label text.
- Font stack must cover Vietnamese diacritics (Inter, Be Vietnam Pro).
- Mobile: `MeetingHistory` and `MeetingDetail` must be usable at 375 px. `NewMeeting` and
  the recorder may be desktop-first.

---

## 9. Every async surface needs three states

Loading, empty, error. A blank screen on failure is the most common reason a working demo
looks broken. Applies to: the history list, the detail page, the upload, the pipeline, and
every export click.
