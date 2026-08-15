# Phase 8 — Deploy + Polish + Submission

## Context Links
- `docs/system.doc/SETUP.md` §6 (deployment), §7 (security checklist)
- `docs/submission.doc/DELIVERABLES.md` — the whole file
- Brainstorm §7 (success criteria)

## Overview
- **Priority:** Blocker — no deploy = no submission
- **Status:** pending
- **Description:** Deploy both apps to live URLs. Produce README, demo video, Trello board, Gantt chart, OneDrive weekly reports. Run security checklist. Buffer for outside-tester feedback.

## Key Insights
- Free-tier hosts sleep — cold start 30-60 s (`SETUP.md` §6). Ping schedule required before demo/evaluation.
- Video file support + speaker attribution + Vietnamese PDF are the three "easy to under-deliver" items in `DELIVERABLES.md` §4 — verify each explicitly on the deployed URL, not just localhost.
- The README is for **evaluators**, not developers. Different audience from `docs/`. Don't merge them (`DELIVERABLES.md` §3).
- Live URL + demo video near the top of README.

## Requirements
- **Functional:** signup → upload → transcribe → summarize → export flow works end-to-end on deployed URLs for user A and user B (isolation preserved)
- **Non-functional:** cold-start-woken backend responds in <3 s. PDF renders correctly. All security checklist items pass.

## Related Code Files
- `README.md` — full rewrite per `DELIVERABLES.md` §3 (Purpose, Setup, Deps, Team table, `.env` format, Extras). Live URL + demo video at top.
- Root `package.json` — verify only what's actually needed (no dead deps)
- Deploy configs:
  - `client/vercel.json` (or Netlify equivalent) — SPA rewrite: all routes → `/index.html`
  - `server/render.yaml` (or Railway equivalent) — start command, env vars, ffmpeg buildpack
- `server/scripts/keep-alive.sh` or Uptime-Robot config — pings `/api/health` every 10 min

## Implementation Steps

1. **Client deploy (Vercel or Netlify):**
   - Connect repo, root directory `client/`
   - Build command `npm run build`, output `dist`
   - Add SPA rewrite `/* → /index.html`
   - Set `VITE_*` env vars in host settings (Production + Preview)
   - Deploy → note the URL

2. **Server deploy (Render preferred — free tier includes ffmpeg):**
   - Root directory `server/`, start `node src/index.js`
   - **Verify `ffmpeg -version` in deploy logs.** If not present, add apt-buildpack or Dockerfile with `apt-get install -y ffmpeg`. Do not assume.
   - Set every `server/.env` var in host env settings (production values, real OpenAI key). `OPENAI_MOCK=false`.
   - `CLIENT_URL` = the Vercel URL exactly (comma-separated if multiple)

3. **Post-deploy wiring:**
   - Server `CLIENT_URL` → client URL
   - Client `VITE_API_URL` + `VITE_SOCKET_URL` → server URL (redeploy client)
   - Supabase Auth → URL Configuration → Site URL = client URL, add both localhost and deployed to redirect URLs
   - Google OAuth client → add deployed callback URL

4. **Smoke on deployed URLs** (per `SETUP.md` §5):
   - Sign up new user (email + Google)
   - Upload 2-min audio → completes → export MD + PDF
   - Sign up user B → confirm no visibility of user A's meetings
   - Upload 30-min Vietnamese video → completes → speakers labelled → PDF diacritics render
   - Upload Zoom `.vtt` → completes without transcription time
   - Refresh mid-processing — poller reconnects, no lost state
   - Rename a speaker, tick an action item — persist
   - Search for a word from a transcript — finds the meeting
   - Delete a meeting — Storage object also cleaned

5. **Security checklist (`SETUP.md` §7):**
   - `git log --all -- '*/.env'` empty
   - `grep -rn "sk-\|eyJ" client/src server/src` clean
   - `OPENAI_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` only in `server/`
   - No `VITE_`-prefixed secret
   - RLS on all 8 tables (spot-check in dashboard)
   - `recordings` bucket private
   - CORS + socket origin (if enabled) are allowlists
   - Cross-user isolation verified

6. **README** — full rewrite. Sections in order per `DELIVERABLES.md` §3:
   1. Live URL + demo video link (top)
   2. Purpose
   3. Setup instructions (both apps + ffmpeg prereq) — condensed from `docs/system.doc/SETUP.md`
   4. Library dependencies (notable ones + purpose)
   5. Team contribution table (Name | GitHub | Role) — required exact format
   6. `.env` format (both tables from `SETUP.md` §3 with placeholders + note that `server/.env` holds secrets)
   7. Extra features (text-upload beyond audio/video Core; note live-summarization deferred)

7. **Demo video** (`DELIVERABLES.md` §7):
   - Use `MOCK_AI=false` (real API) — but have `MOCK_AI=true` ready as insurance
   - Wake the backend 60 s before recording
   - Include: sign in, upload real recording, real-time progress, finished summary with speakers/tags/action items, rename speaker, tick action item, search history, export PDF, open the PDF
   - Keep it short (~3 min)

8. **Trello board** — reflect real task tracking from the plan-hydrated tasks. Columns: Backlog / In Progress / Review / Done. Each phase maps to a swim-lane or label.

9. **Gantt chart** — plot the 8 phases against calendar dates (submitted before actual work; `DELIVERABLES.md` §1 says due 5 days after project release). Include a buffer week.

10. **OneDrive weekly reports** — link from README. Update weekly.

11. **Keep-alive** — Uptime-Robot (free) hitting `GET /api/health` every 10 min. Prevents cold starts eating into evaluator time.

## Todo List
- [ ] Client deployed to Vercel/Netlify with SPA rewrite
- [ ] Server deployed to Render/Railway with ffmpeg verified
- [ ] All env vars set on both hosts
- [ ] Supabase Auth URLs configured for deployed origin
- [ ] Google OAuth callback URL added
- [ ] Full smoke test on deployed URLs (both users, video + text)
- [ ] Vietnamese PDF diacritics verified on deployed URL
- [ ] Security checklist passes
- [ ] README complete with live URL + demo video link
- [ ] Demo video recorded + uploaded
- [ ] Trello board matches reality
- [ ] Gantt chart submitted (deadline is 5 days after release, before this phase — verify)
- [ ] OneDrive reports linked
- [ ] Keep-alive pinger running
- [ ] Final commit as `chore: deployment + submission artifacts`

## Success Criteria
- Evaluator opens live URL, signs up, uploads a real recording, gets meeting minutes, downloads a PDF — all without a bug report
- Backend awake when evaluator opens the app (keep-alive doing its job)
- Every checkbox in `DELIVERABLES.md` §4 Core ticks on the deployed URL
- Security checklist clean
- README readable by someone with no prior context

## Risk Assessment
- **Risk:** Render's Node image lacks ffmpeg. **Mitigation:** verify in deploy logs; if absent, Dockerfile with `apt-get install -y ffmpeg`. **Test this FIRST**, before anything else in this phase.
- **Risk:** cold-start hits evaluators. **Mitigation:** Uptime-Robot pinger. If evaluators still hit it, README notes "first request may take 30 s if the backend has been idle".
- **Risk:** OpenAI hits rate limit during evaluator load. **Mitigation:** ensure account has adequate quota; `OPENAI_MOCK=true` fallback documented in README under "Extra features" as a demo path.
- **Risk:** demo video reveals a bug that wasn't caught. **Mitigation:** record video AFTER outside-tester feedback loop, not before.
- **Risk:** last-minute PDF font/diacritic regression. **Mitigation:** the PDF smoke on the deployed URL is a hard checkbox; do not skip.

## Security Considerations
- Cross-user isolation retest on deployed URLs (RLS bypass by service-role key means the repo-layer scoping is doing all the work)
- No secrets in git history (checklist)
- CORS is an allowlist for the deployed client URL, not `*`

## Next Steps
- Phase 9 (post-submission parking) — only if there's runway
- After submission: monitor Uptime-Robot, respond to evaluator questions if any
