create table if not exists public.write_idea_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null default '',
  created_at timestamptz default now()
);

create index if not exists write_idea_cards_project_created_idx
  on public.write_idea_cards (project_id, created_at desc);

alter table public.write_idea_cards enable row level security;

create policy write_idea_cards_select on public.write_idea_cards
  for select using (auth.uid() = user_id);

create policy write_idea_cards_insert on public.write_idea_cards
  for insert with check (auth.uid() = user_id);

create policy write_idea_cards_update on public.write_idea_cards
  for update using (auth.uid() = user_id);

create policy write_idea_cards_delete on public.write_idea_cards
  for delete using (auth.uid() = user_id);

create table if not exists public.write_permanent_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_number text not null default '',
  card_type text not null,
  title text not null default '',
  created_at timestamptz default now(),
  constraint write_permanent_cards_type_chk check (
    card_type in ('event', 'character', 'worldview', 'place')
  )
);

create index if not exists write_permanent_cards_project_idx
  on public.write_permanent_cards (project_id);

alter table public.write_permanent_cards enable row level security;

create policy write_permanent_cards_select on public.write_permanent_cards
  for select using (auth.uid() = user_id);

create policy write_permanent_cards_insert on public.write_permanent_cards
  for insert with check (auth.uid() = user_id);

create policy write_permanent_cards_update on public.write_permanent_cards
  for update using (auth.uid() = user_id);

create policy write_permanent_cards_delete on public.write_permanent_cards
  for delete using (auth.uid() = user_id);
