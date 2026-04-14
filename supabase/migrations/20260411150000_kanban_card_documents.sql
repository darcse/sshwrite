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

create policy write_kanban_card_documents_delete on public.write_kanban_card_documents
  for delete using (auth.uid() = user_id);
