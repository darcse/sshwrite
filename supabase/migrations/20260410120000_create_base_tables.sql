create table if not exists public.write_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  description text,
  type text not null default 'novel',
  cover_color text,
  cover_image_url text,
  worldview_context text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists write_projects_user_updated_idx
  on public.write_projects (user_id, updated_at desc);

alter table public.write_projects enable row level security;

create policy write_projects_select on public.write_projects
  for select using (auth.uid() = user_id);

create policy write_projects_insert on public.write_projects
  for insert with check (auth.uid() = user_id);

create policy write_projects_update on public.write_projects
  for update using (auth.uid() = user_id);

create policy write_projects_delete on public.write_projects
  for delete using (auth.uid() = user_id);

create table if not exists public.write_document_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  color text not null default '#6b7280'
);

create index if not exists write_document_labels_project_idx
  on public.write_document_labels (project_id);

alter table public.write_document_labels enable row level security;

create policy write_document_labels_select on public.write_document_labels
  for select using (auth.uid() = user_id);

create policy write_document_labels_insert on public.write_document_labels
  for insert with check (auth.uid() = user_id);

create policy write_document_labels_update on public.write_document_labels
  for update using (auth.uid() = user_id);

create policy write_document_labels_delete on public.write_document_labels
  for delete using (auth.uid() = user_id);

create table if not exists public.write_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.write_documents (id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  synopsis text,
  label_id uuid references public.write_document_labels (id) on delete set null,
  memo text,
  status text not null default 'todo',
  order_index integer not null default 0,
  type text not null default 'document',
  search_vector tsvector,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint write_documents_type_chk check (type in ('folder', 'document')),
  constraint write_documents_status_chk check (status in ('todo', 'writing', 'done'))
);

create index if not exists write_documents_project_order_idx
  on public.write_documents (project_id, order_index);

create index if not exists write_documents_parent_idx
  on public.write_documents (parent_id);

create index if not exists write_documents_search_vector_idx
  on public.write_documents using gin (search_vector);

create or replace function public.write_documents_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.content::text, '')), 'B');
  return new;
end;
$$;

drop trigger if exists write_documents_search_vector_trigger on public.write_documents;

create trigger write_documents_search_vector_trigger
  before insert or update of title, content on public.write_documents
  for each row
  execute function public.write_documents_search_vector_update();

alter table public.write_documents enable row level security;

create policy write_documents_select on public.write_documents
  for select using (auth.uid() = user_id);

create policy write_documents_insert on public.write_documents
  for insert with check (auth.uid() = user_id);

create policy write_documents_update on public.write_documents
  for update using (auth.uid() = user_id);

create policy write_documents_delete on public.write_documents
  for delete using (auth.uid() = user_id);

create table if not exists public.write_characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  name text not null default '',
  description text,
  memo text,
  tags jsonb not null default '[]'::jsonb,
  image_url text,
  order_index integer not null default 0,
  constraint write_characters_type_chk check (type in ('character', 'place'))
);

create index if not exists write_characters_project_order_idx
  on public.write_characters (project_id, type, order_index);

alter table public.write_characters enable row level security;

create policy write_characters_select on public.write_characters
  for select using (auth.uid() = user_id);

create policy write_characters_insert on public.write_characters
  for insert with check (auth.uid() = user_id);

create policy write_characters_update on public.write_characters
  for update using (auth.uid() = user_id);

create policy write_characters_delete on public.write_characters
  for delete using (auth.uid() = user_id);

create table if not exists public.write_character_interviews (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.write_characters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz default now()
);

create index if not exists write_character_interviews_character_idx
  on public.write_character_interviews (character_id, created_at desc);

alter table public.write_character_interviews enable row level security;

create policy write_character_interviews_select on public.write_character_interviews
  for select using (auth.uid() = user_id);

create policy write_character_interviews_insert on public.write_character_interviews
  for insert with check (auth.uid() = user_id);

create policy write_character_interviews_update on public.write_character_interviews
  for update using (auth.uid() = user_id);

create policy write_character_interviews_delete on public.write_character_interviews
  for delete using (auth.uid() = user_id);

create table if not exists public.write_snapshots (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.write_documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  content jsonb not null,
  created_at timestamptz default now()
);

create index if not exists write_snapshots_document_created_idx
  on public.write_snapshots (document_id, created_at desc);

alter table public.write_snapshots enable row level security;

create policy write_snapshots_select on public.write_snapshots
  for select using (auth.uid() = user_id);

create policy write_snapshots_insert on public.write_snapshots
  for insert with check (auth.uid() = user_id);

create policy write_snapshots_update on public.write_snapshots
  for update using (auth.uid() = user_id);

create policy write_snapshots_delete on public.write_snapshots
  for delete using (auth.uid() = user_id);

create table if not exists public.write_idea_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null default '',
  status text not null default 'pending',
  created_at timestamptz default now(),
  constraint write_idea_cards_status_chk check (status in ('pending', 'converted'))
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
  type text not null,
  title text not null default '',
  sections jsonb not null default '{}'::jsonb,
  exported_at timestamptz,
  created_at timestamptz default now(),
  constraint write_permanent_cards_type_chk check (
    type in ('사건', '캐릭터', '세계관', '장소')
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

create table if not exists public.write_permanent_card_documents (
  card_id uuid not null references public.write_permanent_cards (id) on delete cascade,
  document_id uuid not null references public.write_documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (card_id, document_id)
);

create index if not exists write_permanent_card_documents_document_idx
  on public.write_permanent_card_documents (document_id);

alter table public.write_permanent_card_documents enable row level security;

create policy write_permanent_card_documents_select on public.write_permanent_card_documents
  for select using (auth.uid() = user_id);

create policy write_permanent_card_documents_insert on public.write_permanent_card_documents
  for insert with check (auth.uid() = user_id);

create policy write_permanent_card_documents_update on public.write_permanent_card_documents
  for update using (auth.uid() = user_id);

create policy write_permanent_card_documents_delete on public.write_permanent_card_documents
  for delete using (auth.uid() = user_id);

create table if not exists public.write_kanban_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.write_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  order_index integer not null default 0,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists write_kanban_columns_project_order_idx
  on public.write_kanban_columns (project_id, order_index);

alter table public.write_kanban_columns enable row level security;

create policy write_kanban_columns_select on public.write_kanban_columns
  for select using (auth.uid() = user_id);

create policy write_kanban_columns_insert on public.write_kanban_columns
  for insert with check (auth.uid() = user_id);

create policy write_kanban_columns_update on public.write_kanban_columns
  for update using (auth.uid() = user_id);

create policy write_kanban_columns_delete on public.write_kanban_columns
  for delete using (auth.uid() = user_id);

create table if not exists public.write_kanban_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.write_kanban_columns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text,
  order_index integer not null default 0,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists write_kanban_cards_column_order_idx
  on public.write_kanban_cards (column_id, order_index);

alter table public.write_kanban_cards enable row level security;

create policy write_kanban_cards_select on public.write_kanban_cards
  for select using (auth.uid() = user_id);

create policy write_kanban_cards_insert on public.write_kanban_cards
  for insert with check (auth.uid() = user_id);

create policy write_kanban_cards_update on public.write_kanban_cards
  for update using (auth.uid() = user_id);

create policy write_kanban_cards_delete on public.write_kanban_cards
  for delete using (auth.uid() = user_id);

create table if not exists public.write_kanban_card_documents (
  card_id uuid not null references public.write_kanban_cards (id) on delete cascade,
  document_id uuid not null references public.write_documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (card_id, document_id)
);

create index if not exists write_kanban_card_documents_document_idx
  on public.write_kanban_card_documents (document_id);

alter table public.write_kanban_card_documents enable row level security;

create policy write_kanban_card_documents_select on public.write_kanban_card_documents
  for select using (auth.uid() = user_id);

create policy write_kanban_card_documents_insert on public.write_kanban_card_documents
  for insert with check (auth.uid() = user_id);

create policy write_kanban_card_documents_update on public.write_kanban_card_documents
  for update using (auth.uid() = user_id);

create policy write_kanban_card_documents_delete on public.write_kanban_card_documents
  for delete using (auth.uid() = user_id);
