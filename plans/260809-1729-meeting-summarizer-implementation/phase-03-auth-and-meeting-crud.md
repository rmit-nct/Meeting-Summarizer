# Phase 3 — Auth foundation + Meeting CRUD + Upload

## Context Links
- Brainstorm §10 (custom-auth revision)
- `docs/system.doc/ARCHITECTURE.md` §2 (module rules), §5.4 (route guard)
- `docs/server.doc/ENDPOINTS.md` §0 auth, §1.5 `/api/auth/*` (new), §1 users, §2 meetings — all updated by Phase 1
- `docs/server.doc/MODELS.md` §2 `users`, `refresh_tokens`, `meetings` — updated by Phase 1
- `docs/client.doc/FRONTEND.md` §2 pages, §6 stores

## Overview
- **Priority:** High — everything downstream needs an authenticated user and a meeting row
- **Status:** pending
- **Description:** Custom auth (register/login/refresh/logout/me) on our own `users` + `refresh_tokens` tables with bcrypt + JWT. Implement `user` + `meeting` modules with CRUD, draft creation, and signed-URL upload (server-issued, using Supabase service-role key). Client gets Login/Signup pages + `NewMeeting` + `MeetingDetail` in its draft-state view.

## Key Insights
- Supabase Auth **dropped** per brainstorm §10. Server issues its own JWTs; owns the `users` and `refresh_tokens` tables.
- **Supabase Storage retained.** Server holds the service-role key, issues short-lived signed upload URLs after verifying our JWT. Client uploads directly to Storage via the signed URL — media never touches the API.
- **RLS dropped.** `auth.uid()` doesn't exist without Supabase Auth. Server-side per-repo `userId` scoping is the sole authorization boundary (per `MODELS.md` §3 it was always the primary boundary anyway; RLS was defence-in-depth). Every repository method still takes and applies `userId`.
- Access token payload matches Tâm's DoD exactly: `{ id, email, name, role, expireAt }`. Signed with `JWT_ACCESS_SECRET`, short TTL (default 15 min).
- Refresh token: signed with `JWT_REFRESH_SECRET`, long TTL (default 7 d), stored in `refresh_tokens` table (hash only — never plaintext) to enable revocation on logout.
- `LESSONS_FROM_TUTORBOT.md` §3 warned against this pattern. We're doing it anyway — small user base, ~5 weeks, team wants to own the flow. Accept the risk; mitigate with rate limiting + strong bcrypt cost.

## Requirements
- **Functional:** register/login/logout/refresh work end-to-end. Authenticated user can create a meeting card, attach a file, and see it as `uploaded`. History list shows their own meetings only.
- **Non-functional:** signing in as user B never surfaces user A's data. All server responses use the shared envelope. All errors go through `errorHandler.js`. Login endpoint rate-limited.

## Architecture
```
Browser  ── POST /api/auth/register ──►  auth.service.register  ── bcrypt.hash ──► users
Browser  ── POST /api/auth/login    ──►  auth.service.login     ── bcrypt.compare + jwt.sign x2
                                                                 └─► refresh_tokens (hash stored)
Browser  ── stores { accessToken, refreshToken } in localStorage
   │
   │  every API call: Authorization: Bearer <accessToken>
   ▼
server ── middleware/authenticate.js ── jwt.verify(access, JWT_ACCESS_SECRET) ── req.user = { id, email, name, role }

Browser  ── POST /api/auth/refresh  { refreshToken } ──►  auth.service.refresh
                                                          ├─ jwt.verify(refresh, JWT_REFRESH_SECRET)
                                                          ├─ lookup refresh_tokens by hash, check not revoked/expired
                                                          └─ issue new access token (rotate refresh: optional but recommended)

Browser  ── POST /api/auth/logout   { refreshToken } ──►  auth.service.logout ── revoked_at = now()
```

Storage flow unchanged from the original plan: signed upload URL issued by our server (using Supabase service-role key), client `PUT`s bytes directly.

## Related Code Files

Create — migrations:
- `server/supabase/migrations/20260810000001_initial_schema.sql` — `users`, `refresh_tokens`, `meetings`, `transcripts`, `summaries`, `summary_points`, `speakers`, `action_items`, `live_sessions`. All 8 tables so RLS drop is trivial (there is nothing to drop) and later phases just fill them.
- `server/supabase/migrations/20260810000002_storage_bucket.sql` — private `recordings` bucket creation (no policy rows — we don't rely on Storage RLS)

Fill (currently empty stubs):
- `server/src/modules/auth/auth.service.js` — `register`, `login`, `refresh`, `logout`, `verifyAccessToken`, `getUserById`
- `server/src/modules/auth/auth.controller.js` — the 5 endpoints
- `server/src/modules/auth/auth.repository.js` (**new stub** — add it) — `users` + `refresh_tokens` DB access
- `server/src/modules/auth/auth.validator.js` (**new stub** — add it) — Zod for register/login/refresh
- `server/src/modules/auth/auth.dto.js` (**new stub** — add it) — shape user for API (strip `password_hash`)
- `server/src/modules/auth/auth.routes.js` (**new stub** — add it) — mount `/api/auth/*`
- `server/src/modules/auth/auth.interface.js` — expose `verifyAccessToken(token)`, `getUserById(id)` for `authenticate.js` and future consumers
- `server/src/middleware/authenticate.js` — verify our JWT, set `req.user`
- `server/src/middleware/rateLimit.js` — wire `express-rate-limit`; apply strict limit on `/api/auth/login` and `/api/auth/register`

Fill (unchanged from original plan):
- `server/src/modules/user/{repository,service,controller,validator,dto,interface,routes}.js` — `GET/PATCH /me`. Now backed by `users` table (not `profiles`).
- `server/src/modules/meeting/{repository,service,controller,validator,dto,interface,routes}.js`
- `server/src/config/upload.js` — signed-URL issuance, MIME/size checks
- `client/src/utils/http.js` — bearer + one 401 handler
- `client/src/stores/auth.store.js` — real auth using our endpoints
- `client/src/routes/RouteGuard.jsx` — real tier enforcement
- `client/src/pages/public/{Login,Signup}.jsx` — real forms; drop `AuthCallback.jsx` (not needed without OAuth redirect)
- `client/src/pages/authenticated/NewMeeting.jsx`
- `client/src/pages/authenticated/MeetingHistory.jsx` — list, no search yet
- `client/src/pages/authenticated/MeetingDetail.jsx` — draft view only
- `client/src/components/Dropzone/*`

Delete/simplify:
- `client/src/utils/supabase.js` — delete. Client no longer needs Supabase SDK.
- `client/src/pages/public/AuthCallback.jsx` — delete (was for OAuth redirect)
- `client/package.json` — remove `@supabase/supabase-js`

Add dependencies:
- server: `npm install bcrypt jsonwebtoken express-rate-limit`

## Implementation Steps

1. **Migrations** — write the schema. Key tables for this phase:
   ```sql
   create table users (
     id uuid primary key default gen_random_uuid(),
     email text not null unique,
     password_hash text not null,
     name text not null,
     avatar_url text,
     role text not null default 'user',      -- 'user' | 'admin' (admin unused for now)
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   create index on users (lower(email));

   create table refresh_tokens (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references users(id) on delete cascade,
     token_hash text not null unique,        -- sha256 of the refresh JWT; never plaintext
     expires_at timestamptz not null,
     revoked_at timestamptz,
     created_at timestamptz not null default now()
   );
   create index on refresh_tokens (user_id) where revoked_at is null;
   create index on refresh_tokens (expires_at);
   ```
   Then `meetings`, `transcripts`, `summaries`, `summary_points`, `speakers`, `action_items`, `live_sessions` per `MODELS.md` §2 — but every `user_id uuid not null references auth.users(id)` becomes `references users(id)`.
   **No `enable row level security` calls.** RLS is dropped for this project.

2. **Server env** — add to `env.js` Zod schema: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_MIN` (default 15), `REFRESH_TOKEN_TTL_DAYS` (default 7), `BCRYPT_ROUNDS` (default 12). Drop `SUPABASE_JWT_SECRET` (never used again).

3. **`auth.repository.js`** — `createUser({email, passwordHash, name})`, `findUserByEmail(email)`, `findUserById(id)`, `updateUser(id, patch)`, `insertRefreshToken({userId, tokenHash, expiresAt})`, `findRefreshTokenByHash(hash)`, `revokeRefreshToken(hash)`, `revokeAllForUser(userId)`.

4. **`auth.service.js`:**
   - `register({email, password, name})`:
     - Assert email not taken (else `invalid_state`)
     - `bcrypt.hash(password, env.BCRYPT_ROUNDS)`
     - Insert `users` row
     - Return the user shape (no password_hash)
   - `login({email, password})`:
     - Find user; if not found, bcrypt-hash-compare against a dummy hash anyway (constant-time defence against user enumeration) then throw `unauthorized`
     - `bcrypt.compare(password, user.password_hash)`; if false, `unauthorized`
     - Issue tokens (see step 5)
     - Return `{ user, accessToken, refreshToken }`
   - `refresh({refreshToken})`:
     - `jwt.verify(refreshToken, env.JWT_REFRESH_SECRET)` → get `{userId}`
     - Hash the token, look up in `refresh_tokens`
     - Reject if not found, revoked, or expired
     - Issue a new access token; rotate refresh (revoke old, insert new) — extra safety
     - Return `{ accessToken, refreshToken }`
   - `logout({refreshToken})`:
     - Hash + `revokeRefreshToken(hash)`. Idempotent; never throws on already-revoked.
   - `verifyAccessToken(token)`:
     - `jwt.verify(token, env.JWT_ACCESS_SECRET)` → returns payload; throw `unauthorized` on any failure
   - `getUserById(id)` — read-through to repo, strips password_hash via dto

5. **Token helpers (private inside `auth.service.js`):**
   ```js
   function signAccess(user) {
     const expiresInMin = env.ACCESS_TOKEN_TTL_MIN;
     return jwt.sign(
       { id: user.id, email: user.email, name: user.name, role: user.role,
         expireAt: Date.now() + expiresInMin * 60_000 },
       env.JWT_ACCESS_SECRET,
       { expiresIn: `${expiresInMin}m` }
     );
   }
   function signRefresh(user) {
     const days = env.REFRESH_TOKEN_TTL_DAYS;
     const token = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: `${days}d` });
     const hash = crypto.createHash('sha256').update(token).digest('hex');
     return { token, hash, expiresAt: new Date(Date.now() + days * 86400_000) };
   }
   ```

6. **`auth.controller.js` + `.routes.js`** — 5 endpoints per `ENDPOINTS.md` §1.5:
   - `POST /api/auth/register` — validate → service → 201 `{ user, accessToken, refreshToken }`
   - `POST /api/auth/login` — validate → service → 200 `{ user, accessToken, refreshToken }`
   - `POST /api/auth/refresh` — validate → service → 200 `{ accessToken, refreshToken }`
   - `POST /api/auth/logout` — validate → service → 204
   - `GET /api/auth/me` — `authenticate` middleware → returns `req.user` (fresh DB fetch via `getUserById` to include latest name/avatar)

7. **`auth.validator.js`** — Zod:
   - register: `{ email: z.string().email(), password: z.string().min(8), name: z.string().min(1).max(100) }`
   - login: `{ email: z.string().email(), password: z.string().min(1) }`
   - refresh + logout: `{ refreshToken: z.string().min(1) }`

8. **`middleware/authenticate.js`:**
   ```js
   export function authenticate(req, res, next) {
     const auth = req.headers.authorization;
     if (!auth?.startsWith('Bearer ')) return next(unauthorized('Missing bearer token'));
     try {
       const payload = authService.verifyAccessToken(auth.slice(7));
       req.user = payload; // { id, email, name, role, expireAt }
       next();
     } catch (err) {
       next(err);  // errorHandler formats
     }
   }
   ```

9. **`middleware/rateLimit.js`** — `express-rate-limit`, one strict limiter for `/api/auth/login` + `/api/auth/register` (e.g. 5/min per IP), separate looser one for everything else if desired.

10. **`app.js`** — mount `authRoutes` at `/api/auth` **without** `authenticate` middleware (auth endpoints are the entry point). Everything else in `/api/*` keeps `authenticate` middleware as before.

11. **`user` module** — `GET/PATCH /me` reads/writes `users` table (no `profiles` table anymore). `user.dto.js` strips `password_hash`. Composes with `shared/dto.js`.

12. **`meeting` module** — unchanged from original plan except: every repo method takes `userId` (as before) and FKs point at `users(id)` not `auth.users(id)`. Behaviour identical.

13. **`config/upload.js`** — unchanged: `issueSignedUploadUrl(userId, meetingId, filename, mimeType)` uses Supabase service-role client. The user's identity is confirmed by our `authenticate.js` before this ever runs. Path stays `{userId}/{meetingId}/{filename}`.

14. **Client `utils/http.js`** — flesh out per `FRONTEND.md` §7:
    - Reads access token from `auth.store.js`, sets `Authorization: Bearer …`
    - Unwraps `{success,data,meta}`, throws typed error on failure
    - On `401` OR `error.code==='token_expired'`: try `authStore.refresh()` once; if that fails, `authStore.signOut()` and redirect to `/login`
    - **This centralizes token refresh** — no component ever hand-writes a refresh call

15. **Client `stores/auth.store.js`:**
    ```js
    export const useAuthStore = create((set, get) => ({
      user: null, accessToken: null, refreshToken: null,
      async signIn(email, password) {
        const { user, accessToken, refreshToken } = await api.post('/api/auth/login', {email, password});
        set({ user, accessToken, refreshToken });
        localStorage.setItem('rt', refreshToken); // temporarily plain — see below
      },
      async signUp(email, password, name) { /* similar */ },
      async refresh() {
        const rt = get().refreshToken ?? localStorage.getItem('rt');
        if (!rt) throw new Error('no refresh token');
        const { accessToken, refreshToken } = await api.post('/api/auth/refresh', { refreshToken: rt });
        set({ accessToken, refreshToken });
        localStorage.setItem('rt', refreshToken);
      },
      signOut() {
        const rt = get().refreshToken;
        if (rt) api.post('/api/auth/logout', { refreshToken: rt }).catch(()=>{});
        set({ user: null, accessToken: null, refreshToken: null });
        localStorage.removeItem('rt');
      },
      async hydrate() {  // called on app mount
        const rt = localStorage.getItem('rt');
        if (!rt) return;
        try { await get().refresh(); const user = await api.get('/api/auth/me'); set({ user }); }
        catch { localStorage.removeItem('rt'); }
      },
    }));
    ```
    Note: refresh token in localStorage is a known XSS-vulnerability trade-off. Acceptable for MVP given no XSS surface (no user-generated HTML rendered). Documented as a follow-up in Phase 9 parking lot if we want to move to httpOnly cookies.

16. **`RouteGuard.jsx`** — read `authStore.user`. `public` bounces authenticated to `/meetings`; `authenticated` bounces guests to `/login`.

17. **Pages Login/Signup** — plain forms, styled per `tokens.css`. Delete `AuthCallback.jsx` (OAuth redirect no longer exists).

18. **`NewMeeting`, `MeetingHistory`, `MeetingDetail` (draft), `Dropzone`** — same as original plan; nothing auth-specific changes here.

19. **`app.jsx` mount** — call `authStore.hydrate()` once on mount to restore session from localStorage.

20. **Smoke test:** register user A, upload a file, log out. Register user B, cannot see A's meeting via API (GET /:id → 404) or history list. Restart the browser — user A's session restores via refresh token.

## Todo List
- [ ] Install `bcrypt`, `jsonwebtoken`, `express-rate-limit`; remove `@supabase/supabase-js` from `client/`
- [ ] Migrations: `users`, `refresh_tokens`, plus all other tables per `MODELS.md` §2 (no RLS)
- [ ] `env.js` — add JWT secrets, TTLs, bcrypt rounds
- [ ] `auth.repository.js` + `.service.js` + `.controller.js` + `.validator.js` + `.dto.js` + `.routes.js` + `.interface.js`
- [ ] `middleware/authenticate.js` real JWT verify
- [ ] `middleware/rateLimit.js` real limiter on `/api/auth/*`
- [ ] `app.js` mounts `/api/auth/*` without middleware; all other `/api/*` with `authenticate`
- [ ] `user` module — 7 files filled (GET/PATCH /me on `users` table)
- [ ] `meeting` module — 8 files filled
- [ ] `config/upload.js` signed URL issuance (Supabase service-role client, unchanged mechanic)
- [ ] Client `http.js` — bearer + 401 handler with one refresh attempt
- [ ] Client `auth.store.js` — signIn/signUp/refresh/logout/hydrate; no Supabase SDK
- [ ] Delete `client/src/utils/supabase.js` and `client/src/pages/public/AuthCallback.jsx`
- [ ] Client pages Login + Signup (drop AuthCallback route from routeTable)
- [ ] `NewMeeting`, `MeetingHistory`, `MeetingDetail` (draft view), `Dropzone`
- [ ] Cross-user isolation smoke test passes
- [ ] Session restore smoke (browser restart) passes
- [ ] Commit sequence: `feat(db): initial schema (users + refresh_tokens + meetings...)`, `feat(auth): custom jwt register/login/refresh/logout + bcrypt`, `feat(user): profile endpoints on users table`, `feat(meeting): crud + signed-url upload`, `feat(client): auth store + login/signup + new meeting + dropzone`

## Success Criteria
- Register A → login A → upload → log out → register B → API and UI show B nothing of A's
- Refresh token rotates on `/refresh` — old refresh token rejected after use
- Logout revokes the refresh token — subsequent `/refresh` with it fails
- Browser restart with valid refresh token restores the session cleanly
- Login endpoint rate-limits after 5 failed attempts/min (429 with `retryAfterMs`)
- Health check + 404 envelope + client dev + client build still pass

## Risk Assessment
- **Risk:** we're consciously doing what `LESSONS_FROM_TUTORBOT.md` §3 warned against. **Mitigation:** strong bcrypt cost (≥12), rate-limit login, hash refresh tokens in DB (never plaintext), constant-time user-enum defence, short access-token TTL. Document trade-off in README.
- **Risk:** refresh token in `localStorage` is XSS-readable. **Mitigation:** we render no untrusted HTML anywhere (all UI is React text nodes). Accept for MVP. Follow-up in Phase 9 parking lot: switch to httpOnly cookie + CSRF token.
- **Risk:** no password reset flow. **Mitigation:** documented in README as "not in scope for MVP; contact team for reset". Add in Phase 9 parking if evaluators care.
- **Risk:** RLS dropped means a single misplaced `.eq('user_id', ...)` omission leaks data. **Mitigation:** repo-layer discipline (already the rule); consider a lint/grep in CI later. For MVP, code-review enforcement.
- **Risk:** `bcrypt` native compile issue on some machines. **Mitigation:** if it fails, fall back to `bcryptjs` (pure JS, slower but works everywhere). Document in team chat.
- **Risk:** signed-URL TTL too short for slow uploads. **Mitigation:** default to 15 min from Supabase; log if uploads fail and surface a "please try again" message.

## Security Considerations
- **Every `meeting.repository.js` method takes `userId`** — no unscoped read. This is now the ONLY authorization boundary (RLS is gone).
- **JWT secrets** in `server/.env` only. Two of them. Never `VITE_`-prefixed. Verify by grep before commit.
- **Password requirements:** min 8 chars (Zod). Deliberately not requiring complexity classes — modern guidance (NIST 800-63B) says length > complexity.
- **Rate limit** on `/api/auth/login` (5/min per IP) and `/api/auth/register` (10/hour per IP) to make brute-force + spam unproductive.
- **Constant-time login response** — hash compare against a dummy hash when email not found, so response timing doesn't reveal user existence.
- **Refresh token rotation** — every `/refresh` invalidates the old token and issues a new one. Detects theft (attacker uses stolen refresh, then victim's next refresh fails → suspicious activity).
- **`SUPABASE_SERVICE_ROLE_KEY` never referenced in `client/`.** Verify by grep before commit.
- MIME allowlist enforced both client (`Dropzone`) and server (`meeting.validator.js` + `config/upload.js`). Server check is authoritative.
- Size limit enforced on both sides.

## Next Steps
- Phase 4 (transcription) implements `POST /:id/process`, subscribes to `meeting:uploaded`, runs ffmpeg + diarize, populates `transcripts` + `speakers`. Zero changes needed vs. the previous phase-04 write-up — auth flow is upstream and orthogonal.
