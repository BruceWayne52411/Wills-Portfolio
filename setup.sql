-- Run this in Supabase SQL editor

-- 1) Tables
create table if not exists public.content (
  key text primary key,
  value text
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  link text,
  image_url text,
  created_at timestamptz default now()
);

-- 2) Seed default content (optional)
insert into public.content(key, value) values
  ('heroTitle','Hi, I\'m Your Name'),
  ('heroSubtitle','Security Officer • Web Dev Student • PC Builder'),
  ('aboutText','Write a short bio about yourself here. You can edit this from Admin.')
on conflict (key) do nothing;

-- 3) Enable RLS
alter table public.content enable row level security;
alter table public.projects enable row level security;

-- 4) Policies
-- Public read
create policy "content read public" on public.content
for select using ( true );

create policy "projects read public" on public.projects
for select using ( true );

-- Authenticated full access
create policy "content write auth" on public.content
for insert with check ( auth.role() = 'authenticated' );
create policy "content update auth" on public.content
for update using ( auth.role() = 'authenticated' );
create policy "content delete auth" on public.content
for delete using ( auth.role() = 'authenticated' );

create policy "projects write auth" on public.projects
for insert with check ( auth.role() = 'authenticated' );
create policy "projects update auth" on public.projects
for update using ( auth.role() = 'authenticated' );
create policy "projects delete auth" on public.projects
for delete using ( auth.role() = 'authenticated' );

-- 5) Storage bucket for project images (via Dashboard -> Storage)
-- Create bucket named: project-images (public)
-- Under Storage Policies, add:
--   (a) Public read:
--     (policy name: "Public read")
--     using (true) to allow anon select (GET) on objects
--   (b) Authenticated can upload:
--     to allow authenticated users to insert objects

-- Alternatively using SQL helpers (if available in your project):
-- select storage.create_bucket('project-images', public => true);
-- Grant authenticated users permission to upload via dashboard policies.