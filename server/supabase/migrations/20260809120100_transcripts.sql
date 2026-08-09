-- transcripts table, one-to-one with meetings. See MODELS.md §2.

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_text text not null default '',
  segments jsonb not null default '[]'::jsonb,
  language text null,
  model text not null,
  word_count int not null default 0,
  -- 'simple', not 'english' — meetings may be in Vietnamese and the English
  -- stemmer would mangle them. See MODELS.md §2.
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(full_text, ''))) stored,
  created_at timestamptz not null default now()
);

create index transcripts_search_idx on transcripts using gin (search_vector);
create index transcripts_meeting_idx on transcripts (meeting_id);

alter table transcripts enable row level security;

create policy "own_transcripts_all" on transcripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
