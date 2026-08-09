-- meetings table + status/source enums. See MODELS.md §1-2.
-- Required before transcripts (FK) can exist.

create type meeting_status as enum (
  'draft', 'uploaded', 'transcribing', 'transcribed', 'summarizing', 'completed', 'failed'
);

create type meeting_source as enum ('upload', 'recording', 'live');

create table meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text null,
  meeting_date date null,
  source_type meeting_source null,
  original_filename text null,
  mime_type text null,
  size_bytes bigint null,
  duration_seconds int null,
  storage_path text null,
  status meeting_status not null default 'draft',
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A meeting stays fileless while it's a draft; every field above is populated
-- together once a file is attached. See MODELS.md §2.
alter table meetings add constraint meeting_file_fields_consistent check (
  (status = 'draft' and storage_path is null)
  or (status != 'draft' and storage_path is not null)
);

create index meetings_user_created_idx on meetings (user_id, created_at desc);
create index meetings_user_status_idx on meetings (user_id, status);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meetings_set_updated_at
  before update on meetings
  for each row execute function set_updated_at();

alter table meetings enable row level security;

-- Defence in depth only — the backend connects with the secret key, which
-- bypasses RLS. The real authorization boundary is meeting.repository.js
-- scoping every query on user_id. See MODELS.md §3.
create policy "own_meetings_all" on meetings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
