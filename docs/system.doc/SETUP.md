# SETUP.md

Local setup, environment variables, and deployment for both applications.

---

## 1. Prerequisites

- Node.js 20+ and npm
- **ffmpeg** on the machine running `server/` (`apt install ffmpeg` / `brew install ffmpeg`).
  Without it, transcription fails on every video file and on most large audio files.
- A Supabase project (free tier is enough)
- A Groq API key — <https://console.groq.com>

---

## 2. Repository layout

```
nct-meeting-summarizer/
├── client/          # React SPA        — own package.json, own .env
├── server/          # Node service     — own package.json, own .env
├── docs/            # ARCHITECTURE.md, MODELS.md, ENDPOINTS.md, …
└── README.md        # graded deliverable
```

One git repository. No nested `.git` directories — that was a real problem on the
predecessor project.

---

## 3. Environment variables

Each app has its own `.env`, copied from a committed `.env.example`. **`.env` is gitignored
and stays that way.** The brief explicitly requires secrets to live in `.env` and the README
to document the format.

### `server/.env`

| Variable | Required | What it is |
| --- | --- | --- |
| `PORT` | no | default `4000` |
| `NODE_ENV` | no | `development` \| `production` |
| `CLIENT_URL` | **yes** | Allowed CORS + socket origin. Comma-separated for multiple. Never `*`. |
| `SUPABASE_URL` | **yes** | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | **Bypasses RLS.** Server only. Never in `client/`. |
| `SUPABASE_JWT_SECRET` | **yes** | Used by `authenticate.js` to verify access tokens |
| `SUPABASE_STORAGE_BUCKET` | no | default `recordings` |
| `GROQ_API_KEY` | **yes** | Server only |
| `GROQ_TRANSCRIPTION_MODEL` | no | default `whisper-large-v3` |
| `GROQ_SUMMARY_MODEL` | no | default `llama-3.3-70b-versatile` |
| `GROQ_AUDIO_MAX_BYTES` | no | per-request audio limit that triggers chunking |
| `MAX_UPLOAD_BYTES` | no | default `524288000` (500 MB) |
| `LIVE_SESSION_TTL_HOURS` | no | default `4` |
| `MOCK_AI` | no | `true` → fixture-backed stub instead of Groq |

### `client/.env`

| Variable | Required | What it is |
| --- | --- | --- |
| `VITE_API_URL` | **yes** | e.g. `http://localhost:4000` |
| `VITE_SOCKET_URL` | **yes** | usually the same host; the namespace `/rt` is appended in code |
| `VITE_SUPABASE_URL` | **yes** | Project URL |
| `VITE_SUPABASE_ANON_KEY` | **yes** | Anon key. Public by design — RLS and the server-side repository scoping are what protect data. |

Everything in `client/.env` ships to the browser. If a value must stay secret, it belongs in
`server/.env`.

### Validated access

Each side reads env **once**, in one file, validated with Zod at module load:
`server/src/config/env.js` and `client/src/config/env.js`. The app should fail loudly at
boot with "GROQ_API_KEY is missing", not mysteriously at 2 a.m. during the demo.

No `process.env` / `import.meta.env` reads anywhere else in either codebase.

---

## 4. Supabase project setup

1. Create the project. Note the URL, anon key, service-role key, and JWT secret.
2. **Auth → Providers:** enable Email. For Google, add the OAuth client and set the redirect
   URL to `${CLIENT_URL}/auth/callback`. Add **both** the local and the deployed URL — a
   redirect URI hardcoded to one environment was a real bug on the predecessor project.
3. **Auth → URL Configuration:** Site URL = the deployed client URL; add
   `http://localhost:5173` to the additional redirect URLs.
4. **Storage:** create a **private** bucket named `recordings`; apply the policies in
   `MODELS.md` §4.
5. **Database:** `npx supabase link --project-ref <ref>` then `npx supabase db push` from
   `server/`. Never create tables by hand in the dashboard.

---

## 5. Run locally

```bash
git clone <repo> && cd nct-meeting-summarizer

# backend
cd server
npm install
cp .env.example .env        # then fill it in
npx supabase db push
npm run dev                 # http://localhost:4000

# frontend, in a second terminal
cd ../client
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

Smoke test after setup — this is the definition of "it works":

1. Sign up with a new email
2. Upload a 2-minute audio file
3. Watch the stepper move **over WebSocket** (check the Network tab: no polling while
   connected)
4. Reach `completed`; confirm summary, topic tags, speakers, and action items render
5. Rename a speaker, tick an action item
6. Search for a word from the transcript in the history list
7. Export Markdown and PDF; open both

If any step fails, that is a bug, not "works on my machine".

---

## 6. Deployment

Two independent deploys, coupled only by the REST/WebSocket contract.

### `client/` → static host (Vercel / Netlify)

- Root directory `client/`, build `npm run build`, output `dist/`.
- **SPA rewrite is mandatory:** all routes → `/index.html`. Without it, refreshing
  `/meetings/abc` returns 404.
- Set `VITE_*` vars in the host's env settings for Production and Preview.
- This URL is the "live deployed link" the brief requires.

### `server/` → long-running Node host (Render / Railway / Fly.io)

- Root directory `server/`, start `node src/index.js`.
- **Must support persistent connections.** A serverless host breaks WebSocket and kills the
  transcription pipeline mid-run.
- **ffmpeg must be present.** Render/Railway Node images usually include it; if not, add an
  apt buildpack or use a Dockerfile with `apt-get install -y ffmpeg`. Verify with
  `ffmpeg -version` in the deploy logs — do not assume.
- Set every `server/.env` var in the host's env settings.
- `CLIENT_URL` must be the deployed client origin, or CORS and the socket handshake fail.

### After deploying, in order

1. Set `CLIENT_URL` on the server to the client's deployed origin.
2. Set `VITE_API_URL` / `VITE_SOCKET_URL` on the client to the server's deployed origin, and
   redeploy the client.
3. Add the client URL to Supabase Auth → URL Configuration, and to the Google OAuth client.
4. Re-run the §5 smoke test **against the deployed URLs**. The brief requires a working live
   link, not just a video.

### Known operational gotcha

Free tiers on Render/Railway sleep idle instances; the first request after sleep can take
30–60 s and will look like a hang. Wake the backend before recording the demo video and
before evaluators open the link. A trivial `GET /api/health` pinged on a schedule is enough.

---

## 7. Security checklist before submission

- [ ] No `.env` in git history (`git log --all --  '*/.env'` is empty)
- [ ] No key literal in either codebase (`grep -rn "gsk_\|eyJ" client/src server/src` is clean)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` appear only under `server/`
- [ ] No `VITE_`-prefixed secret
- [ ] RLS enabled on all eight tables
- [ ] The `recordings` bucket is private
- [ ] CORS and socket origin are an allowlist, not `*`
- [ ] Every repository method takes and applies `userId`
- [ ] Signing in as user B shows none of user A's meetings
- [ ] Both `.env.example` files contain placeholders only
