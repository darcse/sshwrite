alter table public.write_idea_cards
  add column if not exists status text not null default 'pending';

alter table public.write_idea_cards
  drop constraint if exists write_idea_cards_status_chk;

alter table public.write_idea_cards
  add constraint write_idea_cards_status_chk check (status in ('pending', 'converted'));

alter table public.write_permanent_cards
  add column if not exists sections jsonb not null default '{}'::jsonb;
