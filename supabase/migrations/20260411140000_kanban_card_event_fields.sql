alter table public.write_kanban_cards
  add column if not exists event_type text,
  add column if not exists event_time text,
  add column if not exists related_persons text;
