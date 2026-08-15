# Phase 2 — AI config swap

## Context Links
- Phase 1 (updated `docs/system.doc/AI_INTEGRATION.md`, `docs/system.doc/SETUP.md`)
- Brainstorm §4 (final tech stack)

## Overview
- **Priority:** High (all pipeline phases depend on this)
- **Status:** pending
- **Description:** Replace `server/src/config/groq.js` with `openai.js`. One SDK, one env-driven base URL — same code path serves prod (OpenAI) and dev (Ollama). Update Zod env schema. Add fixture stub for `OPENAI_MOCK=true`.

## Key Insights
- Ollama exposes an OpenAI-compatible `/v1` API — same `openai` SDK client works against both by just overriding `baseURL`
- `OPENAI_MOCK=true` swaps the client itself for a fixture-backed stub. Zero method signature changes upstream — the whole point of putting the SDK in the config layer per `ARCHITECTURE.md` §2.3
- **Do not** implement transcription or summarization service methods here. This phase only wires the client; service methods land in Phases 4 + 5.

## Requirements
- **Functional:** `import { openai } from '../config/openai.js'` returns either a real client, an Ollama-pointed client, or a fixture stub — decided by env
- **Non-functional:** boot fails loudly if `OPENAI_API_KEY` missing AND `OPENAI_MOCK=false` AND `OPENAI_BASE_URL` points at api.openai.com

## Architecture
Config layer only. No module code touched.

```
config/openai.js
   ├── real prod client        → new OpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL })
   ├── real dev client (Ollama) → same, with baseURL=http://localhost:11434/v1, apiKey='ollama'
   └── fixture stub             → replicates .chat.completions.create + .audio.transcriptions.create
                                   from JSON fixtures under server/fixtures/
```

## Related Code Files
Delete:
- `server/src/config/groq.js`

Create:
- `server/src/config/openai.js`
- `server/fixtures/transcript-sample.json`
- `server/fixtures/summary-sample.json`
- `server/fixtures/openai-mock.js` (the stub client)

Edit:
- `server/src/config/env.js` — Zod schema
- `server/.env.example` — replace `GROQ_*` block with `OPENAI_*` block
- `server/.env` — same
- `server/package.json` — remove `groq-sdk`, add `openai`

## Implementation Steps

1. **`server/package.json`:**
   ```
   npm uninstall groq-sdk
   npm install openai
   ```

2. **`server/src/config/env.js`** — replace Groq rows in the Zod schema:
   ```js
   OPENAI_API_KEY: z.string().min(1),
   OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
   OPENAI_SUMMARY_MODEL: z.string().default('gpt-5.6-luna'),
   OPENAI_TRANSCRIPTION_MODEL: z.string().default('gpt-4o-transcribe-diarize'),
   OPENAI_MOCK: z.coerce.boolean().default(false),
   OPENAI_AUDIO_MAX_BYTES: z.coerce.number().default(26214400),
   ```
   Placeholder `replace-me` still satisfies `.min(1)`, so boot succeeds during scaffolding.

3. **`server/.env.example`** + **`server/.env`** — mirror the schema. Include a commented line showing the Ollama override:
   ```
   # Dev-mode override: run gpt-oss-20b in Ollama and point here
   # OPENAI_BASE_URL=http://localhost:11434/v1
   # OPENAI_API_KEY=ollama
   # OPENAI_SUMMARY_MODEL=gpt-oss:20b
   ```

4. **`server/src/config/openai.js`** — create:
   ```js
   import OpenAI from 'openai';
   import { env } from './env.js';
   import { createMockClient } from '../../fixtures/openai-mock.js';

   export const openai = env.OPENAI_MOCK
     ? createMockClient()
     : new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });
   ```

5. **Delete `server/src/config/groq.js`.** Grep for imports (`grep -rn "config/groq" server/src`) — should be zero.

6. **`server/fixtures/transcript-sample.json`** — a real diarize-shaped response:
   ```json
   { "text": "…", "language": "en",
     "segments": [
       { "id": 0, "start": 0.0, "end": 4.2, "text": "Okay so the deadline moved.", "speaker": "Speaker 1" },
       { "id": 1, "start": 4.2, "end": 8.6, "text": "Right, I'll redo the Gantt.",  "speaker": "Speaker 2" }
     ] }
   ```

7. **`server/fixtures/summary-sample.json`** — a real Structured Output response matching the schema Phase 5 will define. Includes overview, speakers, points (with category + speakerLabel + startMs), actionItems (with `dueDate: null` cases to test normalization).

8. **`server/fixtures/openai-mock.js`** — export `createMockClient()` returning an object with `.audio.transcriptions.create({...})` and `.chat.completions.create({...})` (or `.responses.create({...})` if using Responses API — check Phase 5 for the exact call shape). Reads the JSON fixtures and returns them as the SDK would.

9. **Smoke:** `npm run dev` in `server/`. Expect the same "listening on 4000" log with no crash. `curl http://localhost:4000/api/health` returns `{"success":true,"data":{"status":"ok"}}`. That confirms nothing regressed.

## Todo List
- [ ] Uninstall `groq-sdk`, install `openai`
- [ ] Update `env.js` Zod schema
- [ ] Update `.env.example` + `.env`
- [ ] Delete `config/groq.js`, create `config/openai.js`
- [ ] Create `fixtures/transcript-sample.json` + `fixtures/summary-sample.json` + `fixtures/openai-mock.js`
- [ ] `grep -rn "config/groq" server/src` returns nothing
- [ ] Smoke test: `npm run dev` boots, `/api/health` responds
- [ ] Commit as `feat(config): swap groq client for openai + ollama-compatible client`

## Success Criteria
- Server boots identically to before this phase
- `OPENAI_MOCK=true npm run dev` also boots (proves the stub loads)
- Setting `OPENAI_BASE_URL=http://localhost:11434/v1` + a running local Ollama makes the same code hit Ollama when service methods land in Phases 4-5

## Risk Assessment
- **Risk:** Responses API vs Chat Completions API shape difference. **Mitigation:** confirm in Phase 5 whether to use `openai.responses.create(...)` (newer, gets prompt caching + persisted reasoning) or `openai.chat.completions.create(...)` (broader compat, simpler). Ollama supports Chat Completions; not sure about Responses. Test both against Ollama early in Phase 5.
- **Risk:** the fixture stub falls out of sync with real API shape. **Mitigation:** save fixtures **from real API calls** during Phase 4-5 dev, not hand-authored.

## Security Considerations
- `OPENAI_API_KEY` server-only. Mirror the CLAUDE.md §4.8 rule that was in place for `GROQ_API_KEY`.
- Never log the key. `logger.js` scrubbing is not needed if we simply never pass it to a log call.

## Next Steps
- Phase 3 lands auth foundation + meeting CRUD; does not touch the AI config
- Phase 4 (transcription) is the first module to actually call `openai.audio.transcriptions.create(...)`
