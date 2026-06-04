-- Activities
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Time entries
create table if not exists time_entries (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid references activities(id) on delete cascade,
  started_at   timestamptz not null default now(),
  stopped_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists time_entries_activity_id_idx on time_entries(activity_id);
create index if not exists time_entries_started_at_idx  on time_entries(started_at);
create index if not exists time_entries_open_idx        on time_entries(stopped_at) where stopped_at is null;

-- Enable realtime on both tables
alter publication supabase_realtime add table activities;
alter publication supabase_realtime add table time_entries;
