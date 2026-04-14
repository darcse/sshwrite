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

create policy write_character_interviews_delete on public.write_character_interviews
  for delete using (auth.uid() = user_id);
