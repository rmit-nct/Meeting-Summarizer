# NCT Meeting Summarizer

<!-- Live URL: TODO -->
<!-- Demo video: TODO -->

## Purpose

A web app for the Neo Culture Tech (NCT) club: upload or record a meeting (audio or video),
get it transcribed, and have an LLM turn it into a scannable summary — bullet points, action
items (task / owner / deadline), speaker attribution, and topic tags (Decisions / Questions /
Blockers). Goal: replace "re-watch the 90-minute recording" with "read 12 bullets".

Core features: sign in/up · upload audio or video · record in-browser · live transcription
progress · full transcript · bullet-point summary · action item extraction · speaker
attribution · topic tagging · export to Markdown and PDF · searchable history by keyword and
date. Stretch feature: live summarization during an ongoing meeting.

See `docs/system.doc/ARCHITECTURE.md` for the full architecture.

## Setup instructions

Full guide: `docs/system.doc/SETUP.md`. Short version:

```bash
git clone <repo> && cd nct-meeting-summarizer

# backend
cd server
npm install
cp .env.example .env        # then fill in real values, see Environment variables below
npx supabase db push
npm run dev                 # http://localhost:4000

# frontend, in a second terminal
cd ../client
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

Prerequisites: Node.js 20+, **ffmpeg** on the machine running `server/` (transcription of
video/large audio fails without it), a Supabase project, and an OpenAI API key
(<https://platform.openai.com>).

## Library dependencies

**`server/`**

| Package | Purpose |
| --- | --- |
| `express` | HTTP server / REST routing |
| `socket.io` | WebSocket server (`/rt` namespace) |
| `@supabase/supabase-js` | Postgres, Auth, and Storage client (service role) |
| `openai` | OpenAI Whisper (transcription) + GPT (summarization) |
| `zod` | Request validation and env var validation |
| `cors` | CORS allowlist |
| `dotenv` | Loads `.env` |
| `nodemon` *(dev)* | Auto-restart in `npm run dev` |
| `eslint` *(dev)* | Linting |

**`client/`**

| Package | Purpose |
| --- | --- |
| `react` / `react-dom` | UI |
| `react-router-dom` | Client-side routing |
| `zustand` | Global state (auth, socket, UI) |
| `socket.io-client` | WebSocket client |
| `@supabase/supabase-js` | Browser Supabase client (anon key) — auth + direct storage upload |
| `zod` | Env var validation |
| `vite` / `@vitejs/plugin-react` *(dev)* | Build tool |
| `oxlint` *(dev)* | Linting |

Root `package.json` adds `concurrently` (dev-only) to run both dev servers with one
`npm run dev`.

## Team contribution table

| Name | GitHub | Role |
| --- | --- | --- |
| | | |

## Environment variables

Each app has its own `.env`, copied from a committed `.env.example`. `.env` is gitignored
and stays that way. Full details: `docs/system.doc/SETUP.md` §3.

### `server/.env`

| Variable | Required | What it is |
| --- | --- | --- |
| `PORT` | no | default `4000` |
| `NODE_ENV` | no | `development` \| `production` |
| `CLIENT_URL` | yes | Allowed CORS + socket origin. Comma-separated for multiple. Never `*`. |
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | New-format Supabase secret key. Bypasses RLS. Server only — never in `client/`. |
| `JWT_ACCESS_SECRET` | yes | Signs/verifies access tokens issued by `modules/auth` |
| `JWT_REFRESH_SECRET` | yes | Signs/verifies refresh tokens issued by `modules/auth` |
| `SUPABASE_STORAGE_BUCKET` | no | default `recordings` |
| `OPENAI_API_KEY` | yes | Server only |
| `OPENAI_TRANSCRIPTION_MODEL` | no | default `whisper-1` |
| `OPENAI_SUMMARY_MODEL` | no | default `gpt-4o-mini` |
| `OPENAI_AUDIO_MAX_BYTES` | no | per-request audio limit that triggers chunking |
| `MAX_UPLOAD_BYTES` | no | default `524288000` (500 MB) |
| `LIVE_SESSION_TTL_HOURS` | no | default `4` |
| `MOCK_AI` | no | `true` → fixture-backed stub instead of calling OpenAI |

### `client/.env`

| Variable | Required | What it is |
| --- | --- | --- |
| `VITE_API_URL` | yes | e.g. `http://localhost:4000` |
| `VITE_SOCKET_URL` | yes | usually the same host; namespace `/rt` is appended in code |
| `VITE_SUPABASE_URL` | yes | Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Anon key. Public by design — RLS and server-side repository scoping protect data. |

Everything in `client/.env` ships to the browser. Anything that must stay secret belongs in
`server/.env` only.

## Extra features

TODO
