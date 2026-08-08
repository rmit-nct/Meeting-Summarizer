# DELIVERABLES.md

Everything the club is graded on, taken from the project brief. A checklist, not background
reading.

---

## 1. Hard deadlines

| Item | Deadline |
| --- | --- |
| **Gantt chart** — all project stages with an expected completion date per stage | **5 days after the project is released** |
| **Final submission** — README, Trello board, video demonstration, code repository | **23:59, Wednesday 17 September 2026** |

The Gantt chart is due first and is the easiest to forget. The number of stages is the
team's choice.

---

## 2. Submission artifacts

- [ ] **Code repository** pushed to the club's official GitHub repo
- [ ] **README.md** (contents in §3)
- [ ] **Demo video** — uploading/recording a meeting, transcription in progress, and the
      final AI-generated summary output
- [ ] **Live deployed link** evaluators can actually use — note this means **both** the
      client (static host) **and** the server (long-running host) must be up
- [ ] **Trello board** reflecting real task tracking
- [ ] **Gantt chart**
- [ ] **OneDrive weekly reports**, linked from the repo

---

## 3. README.md — required sections

The brief lists these explicitly. A missing section loses marks for zero effort.
The README is for evaluators; `docs/` is for developers. Do not merge them.

1. **Purpose** — a short paragraph: what the tool does, why it was built, how it works at a
   high level.
2. **Setup instructions** — running it locally, start to finish, **for both `client/` and
   `server/`**, including the ffmpeg prerequisite. Condense `SETUP.md`.
3. **Library dependencies** — the notable ones and what each is for.
4. **Team contribution table** — must include **name, GitHub account, role**:

   | Name | GitHub | Role |
   | --- | --- | --- |
   | | | |

5. **`.env` format and what needs to be input** — both env tables from `SETUP.md` §3 with
   placeholder values, and a note that `server/.env` holds the secrets.
6. **Extra features description** — anything beyond the Core list.
7. Note that secrets live in `.env` and are never committed.

Put the live URL and the demo video link near the top.

---

## 4. Feature checklist — definition of done

### Core — all required
- [ ] Sign In / Sign Up
- [ ] Upload a meeting recording (audio **or video** file)
- [ ] Record directly in-browser
- [ ] View transcription progress
- [ ] Access the full generated transcript
- [ ] AI-generated summary in bullet-point form
- [ ] Automatic action item extraction — task, **owner**, **deadline**
- [ ] Speaker attribution — points labelled with who raised each one
- [ ] Topic tagging — bullets categorized (Decisions, Questions, Blockers, …)
- [ ] Export summaries as **Markdown**
- [ ] Export summaries as **PDF**
- [ ] Searchable history **by keyword** and **by date**

Three Core items are easy to under-deliver — check each explicitly:
- **Video file support** needs server-side ffmpeg audio extraction (`AI_INTEGRATION.md` §2)
  *and* ffmpeg present on the deploy host (`SETUP.md` §6).
- **Speaker attribution** — Whisper does not diarize (`AI_INTEGRATION.md` §4). Ship the
  inference plus the rename UI, and describe it accurately.
- **PDF export** must render Vietnamese diacritics (`ENDPOINTS.md` §6).

### Additional — stretch only
- [ ] Live summarization during an ongoing meeting
      (`LiveSession` + `/rt` namespace — `ARCHITECTURE.md` §3.3)

---

## 5. Suggested stages for the Gantt chart

Shift the dates to the real release date; the shape is what matters. Each stage ends with
something demonstrable, not "code written".

| Stage | Work | Exit criterion |
| --- | --- | --- |
| 1. Foundation | Repo layout, `client/` + `server/` scaffolds, module skeleton, shared middleware/envelope/event bus, Supabase project, migrations, auth + route guard, **both apps deployed** | A signed-in user sees an empty history page **on the live URLs**, with CORS and the socket handshake working |
| 2. Upload pipeline | Signed-URL upload, Dropzone, Recorder, `meeting` module CRUD, WebSocket progress plumbing | A file reaches Storage, a `meetings` row is `uploaded`, and the stepper updates over WebSocket |
| 3. Transcription | ffmpeg preprocessing, chunking, Whisper, `transcript` module, TranscriptView | A 30-minute **video** file produces a readable, correctly-timestamped transcript |
| 4. Summarization | Prompt, JSON parsing/normalization, `summary` + `action-item` modules, `overview` aggregator, detail page | Summary, tags, speakers, and action items all render from one request |
| 5. Features | Search + date filter, Markdown/PDF export, speaker rename, action item editing, three-state UI everywhere | Every Core checkbox ticked |
| 6. Polish & submit | Error/empty states, mobile, README, demo video, Trello, final deploy verification | Submission checklist complete |

Leave stage 6 at least a full week. Recording a good demo, writing the README, and fixing
whatever the first outside tester breaks always takes longer than planned.

Attempt the live-summarization stretch only if stage 5 finishes early.

---

## 6. Repository hygiene — explicitly graded

The brief asks for "clear and organized code structure", "proper file organization,
meaningful commit messages, and modular code". The architecture already delivers the
structure; keep the rest honest.

- **One repository**, `client/` and `server/` side by side. No nested `.git`.
- **Commit messages:** `type(scope): imperative summary` —
  `feat(transcript): chunk audio above the groq size limit`,
  `fix(summary): keep completed action items on resummarize`.
  Not `update`, not `fix bug`, not `asdf`.
- **Branches:** `main` always deployable; work on `feat/…` and `fix/…`, merge via PR.
- **No dead files.** No unused dependencies, no commented-out blocks, no scratch test
  scripts committed. The predecessor project shipped `fastapi`/`uvicorn` in
  `requirements.txt` while running Flask — reviewers notice.
- **No stale docs.** If a doc no longer matches the code, fix it or delete it. Documentation
  that contradicts the code was the clearest failure of the predecessor repo.
- **Module boundaries hold in review.** A PR that imports another module's service or
  repository directly gets sent back — that rule is the whole point of the architecture.

---

## 7. Demo video notes

Short, and show the real thing:

1. Sign in (10 s)
2. Upload a real recording — or record live, which is more convincing (30 s)
3. The progress stepper moving in real time (15 s)
4. The finished summary: bullets, category tags, speaker labels, action items (60 s)
5. Rename a speaker, tick an action item (15 s)
6. Search the history, export a PDF, open it (20 s)

Use a real meeting recording, not a 20-second test clip — a summary of a trivial input looks
trivial. Wake the backend first (`SETUP.md` §6). Have `MOCK_AI=true` output ready as a
fallback in case Groq rate-limits you mid-take.
