-- =============================================================================
-- NCT Meeting Summarizer — initial schema (all 9 tables)
--
-- Consolidates three previously-conflicting sources into one forward-only file:
--   - feature/auth-login-register : users, refresh_tokens
--   - feat/transcript-api         : meetings, transcripts
--   - MODELS.md §2                : summaries, summary_points, speakers,
--                                   action_items, live_sessions
--
-- Three deliberate changes from those sources, per brainstorm §10 (auth revision):
--   1. Every `references auth.users(id)` is now `references public.users(id)`.
--      Supabase Auth is dropped; auth.users is not our identity table.
--   2. All `enable row level security` + `auth.uid()` policies are REMOVED.
--      auth.uid() does not exist without Supabase Auth, so those policies would
--      evaluate to null and silently deny everything (or be dead weight).
--      >>> The sole authorization boundary is now the repository layer: every
--      >>> method takes userId and applies .eq('user_id', userId). See
--      >>> MODELS.md §3 and phase-03. Do not re-add RLS without also
--      >>> re-adding an identity provider that populates auth.uid().
--   3. Tables are ordered by dependency, not by the date someone wrote them.
--      users must exist before meetings; speakers before summary_points and
--      action_items, which reference it.
--
-- Storage: the `recordings` bucket stays private and is NOT protected by a
-- storage policy (the MODELS.md §4 policy also relies on auth.uid()). It is
-- protected because only our server holds the service-role key and only issues
-- signed URLs after authenticate.js has verified our own JWT.
--
-- Apply with:  cd server && npx supabase db push
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums (MODELS.md §1)
-- -----------------------------------------------------------------------------

create type meeting_status as enum (
  'draft', 'uploaded', 'transcribing', 'transcribed', 'summarizing', 'completed', 'failed'
);

create type meeting_source as enum ('upload', 'recording', 'live');

-- Topic tagging categories required by the brief.
create type point_category as enum (
  'decision', 'action', 'question', 'blocker', 'risk', 'discussion'
);

create type live_session_state as enum ('active', 'ended', 'expired', 'failed');

-- -----------------------------------------------------------------------------
-- Shared trigger function — maintains updated_at (MODELS.md §0)
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users — module: auth
-- Replaces the `profiles` table from MODELS.md §2. We own identity now, so
-- there is no auth.users to mirror.
-- -----------------------------------------------------------------------------

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  name          text not null,
  avatar_url    text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Case-insensitive uniqueness. Note: this means lookups must also use
-- lower(email), or the index will not be used.
create unique index users_email_unique on public.users (lower(email));

create trigger users_set_updated_at
  before update on public.users
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- refresh_tokens — module: auth
-- Stores a sha256 hash of the refresh JWT, never the token itself, so a DB
-- leak does not hand out live sessions. Rows are revoked, not deleted, so
-- rotation can detect reuse of a stolen token.
-- -----------------------------------------------------------------------------

create table public.refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index refresh_tokens_active_user_idx
  on public.refresh_tokens (user_id) where revoked_at is null;
create index refresh_tokens_expires_at_idx
  on public.refresh_tokens (expires_at);

-- -----------------------------------------------------------------------------
-- meetings — module: meeting
-- The durable record. Owns the status machine (ARCHITECTURE.md §4.1).
-- A meeting can exist with no file at all, which is why every file-related
-- column is nullable — they stay null for as long as it sits in 'draft'.
-- -----------------------------------------------------------------------------

create table public.meetings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  title             text not null,
  description       text,
  meeting_date      date,
  source_type       meeting_source,
  original_filename text,
  mime_type         text,
  size_bytes        bigint,
  duration_seconds  int,
  -- {user_id}/{meeting_id}/{filename} in the `recordings` bucket.
  -- NEVER serialized to a client — stripped by shared/dto.js.
  storage_path      text,
  status            meeting_status not null default 'draft',
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Stops the table drifting into a half-attached state. The upload endpoint must
-- therefore set status and storage_path in ONE update statement, not two.
alter table public.meetings add constraint meeting_file_fields_consistent check (
  (status = 'draft' and storage_path is null)
  or (status <> 'draft' and storage_path is not null)
);

create index meetings_user_created_idx on public.meetings (user_id, created_at desc);
create index meetings_user_status_idx  on public.meetings (user_id, status);

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- transcripts — module: transcript
-- One-to-one with meetings.
-- -----------------------------------------------------------------------------

create table public.transcripts (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  full_text  text not null default '',
  -- Trimmed segments: [{ id, start, end, text, speaker_id }]
  segments   jsonb not null default '[]'::jsonb,
  language   text,
  model      text not null,
  word_count int not null default 0,
  -- 'simple', not 'english' — meetings may be in Vietnamese and the English
  -- stemmer would mangle them. See MODELS.md §2.
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(full_text, ''))
  ) stored,
  created_at timestamptz not null default now()
);

create index transcripts_search_idx on public.transcripts using gin (search_vector);
create index transcripts_user_idx   on public.transcripts (user_id);

-- -----------------------------------------------------------------------------
-- summaries — module: summary
-- One-to-one with meetings.
-- -----------------------------------------------------------------------------

create table public.summaries (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null unique references public.meetings(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  overview       text not null default '',
  model          text not null,
  -- Exactly what the model returned, pre-normalization. NEVER serialized to a
  -- client. It is how you debug a bad summary, and what MD/PDF re-download
  -- reads from instead of re-calling the LLM (brainstorm §3.6).
  raw_response   jsonb,
  prompt_version text not null default '1',
  created_at     timestamptz not null default now()
);

create index summaries_user_idx on public.summaries (user_id);

-- -----------------------------------------------------------------------------
-- speakers — module: summary (written by transcript; see brainstorm §3.1)
-- With real diarization these are produced at the transcription step, not
-- inferred later. `label` is model-produced and immutable; `display_name` is
-- the user's rename. UI shows coalesce(display_name, label).
-- Created BEFORE summary_points and action_items, which reference it.
-- -----------------------------------------------------------------------------

create table public.speakers (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  label        text not null,
  display_name text,
  color        text
);

create unique index speakers_meeting_label_unique on public.speakers (meeting_id, label);
create index speakers_user_idx on public.speakers (user_id);

-- -----------------------------------------------------------------------------
-- summary_points — module: summary
-- The bullets. Carries both the topic tag and the speaker attribution the
-- brief requires.
-- -----------------------------------------------------------------------------

create table public.summary_points (
  id          uuid primary key default gen_random_uuid(),
  summary_id  uuid not null references public.summaries(id) on delete cascade,
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  content     text not null,
  category    point_category not null,
  speaker_id  uuid references public.speakers(id) on delete set null,
  start_ms    int,
  order_index int not null default 0
);

create index summary_points_meeting_order_idx
  on public.summary_points (meeting_id, order_index);
create index summary_points_user_idx on public.summary_points (user_id);

-- -----------------------------------------------------------------------------
-- action_items — module: action-item
-- A separate table, not a point_category row, because these carry
-- owner/deadline/done state and get their own UI and CRUD.
-- -----------------------------------------------------------------------------

create table public.action_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  content     text not null,
  owner_id    uuid references public.speakers(id) on delete set null,
  owner_label text,
  -- Model-extracted, often null. NEVER invent one — a wrong deadline in a
  -- meeting summary is worse than a missing one (AI_INTEGRATION.md §3).
  due_date    date,
  is_done     boolean not null default false,
  order_index int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index action_items_meeting_order_idx
  on public.action_items (meeting_id, order_index);
create index action_items_user_done_idx on public.action_items (user_id, is_done);

create trigger action_items_set_updated_at
  before update on public.action_items
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- live_sessions — module: live-session (transient)
-- Deferred to post-submission (brainstorm §2), but the table ships now so the
-- schema is complete and Phase 9 needs no migration. Nothing writes to it yet.
-- -----------------------------------------------------------------------------

create table public.live_sessions (
  id                 uuid primary key default gen_random_uuid(
create index live_sessions_sweeper_idx on public.live_sessions (state, expires_at);
create index live_sessions_user_idx    on public.live_sessions (user_id);

create trigger live_sessions_set_updated_at
  before update on public.live_sessions
  for each row execute function set_updated_at();
),
  user_id            uuid not null references public.users(id) on delete cascade,
  socket_id          text,
  title              text not null,
  meeting_date       date,
  state              live_session_state not null default 'active',
  chunk_count        int not null default 0,
  running_transcript text not null default '',
  rolling_summary    jsonb,
  meeting_id         uuid references public.meetings(id) on delete set null,
  expires_at         timestamptz not null default now() + interval '4 hours',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
