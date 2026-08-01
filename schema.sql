-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Folders Table
create table public.folders (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    parent_id uuid references public.folders(id) on delete cascade,
    created_by uuid references auth.users(id) not null default auth.uid(),
    updated_at timestamptz not null default now()
);

-- Charts Table
create table public.charts (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    tempo integer,
    time_sig text,
    lines jsonb not null default '[]'::jsonb,
    semitone_offset integer not null default 0,
    prefer_flats boolean not null default false,
    folder_id uuid references public.folders(id) on delete cascade,
    created_by uuid references auth.users(id) not null default auth.uid(),
    updated_at timestamptz not null default now()
);

-- Set up Row Level Security (RLS)
alter table public.folders enable row level security;
alter table public.charts enable row level security;

-- NOTE: Currently, the library is fully shared among ALL authenticated users.
-- To restrict to a specific band/org later, you could add an `org_id` column 
-- to these tables and modify the policies to check `org_id = user_org_id()`.

-- Folders policies
create policy "Authenticated users can select any folder"
on public.folders for select to authenticated using (true);

create policy "Authenticated users can insert folders"
on public.folders for insert to authenticated with check (true);

create policy "Authenticated users can update any folder"
on public.folders for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete any folder"
on public.folders for delete to authenticated using (true);

-- Charts policies
create policy "Authenticated users can select any chart"
on public.charts for select to authenticated using (true);

create policy "Authenticated users can insert charts"
on public.charts for insert to authenticated with check (true);

create policy "Authenticated users can update any chart"
on public.charts for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete any chart"
on public.charts for delete to authenticated using (true);
