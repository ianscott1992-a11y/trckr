alter table activities add column if not exists parent_id uuid references activities(id) on delete cascade;
create index if not exists activities_parent_id_idx on activities(parent_id);
