create table if not exists public.write_kanban_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  order_index integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.write_kanban_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.write_kanban_columns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text,
  order_index integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists write_kanban_columns_project_order_idx
  on public.write_kanban_columns (project_id, order_index);

create index if not exists write_kanban_cards_column_order_idx
  on public.write_kanban_cards (column_id, order_index);

alter table public.write_kanban_columns enable row level security;
alter table public.write_kanban_cards enable row level security;

create policy write_kanban_columns_select on public.write_kanban_columns
  for select using (auth.uid() = user_id);

create policy write_kanban_columns_insert on public.write_kanban_columns
  for insert with check (auth.uid() = user_id);

create policy write_kanban_columns_update on public.write_kanban_columns
  for update using (auth.uid() = user_id);

create policy write_kanban_columns_delete on public.write_kanban_columns
  for delete using (auth.uid() = user_id);

create policy write_kanban_cards_select on public.write_kanban_cards
  for select using (auth.uid() = user_id);

create policy write_kanban_cards_insert on public.write_kanban_cards
  for insert with check (auth.uid() = user_id);

create policy write_kanban_cards_update on public.write_kanban_cards
  for update using (auth.uid() = user_id);

create policy write_kanban_cards_delete on public.write_kanban_cards
  for delete using (auth.uid() = user_id);
