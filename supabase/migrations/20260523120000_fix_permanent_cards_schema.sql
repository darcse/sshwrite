alter table public.write_permanent_cards
  drop constraint if exists write_permanent_cards_type_check;

alter table public.write_permanent_cards
  drop constraint if exists write_permanent_cards_type_chk;

alter table public.write_permanent_cards
  add column if not exists type text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'write_permanent_cards'
      and column_name = 'card_type'
  ) then
    update public.write_permanent_cards
    set type = case trim(card_type)
      when 'event' then '사건'
      when 'character' then '캐릭터'
      when 'worldview' then '세계관'
      when 'place' then '장소'
      else coalesce(nullif(trim(type), ''), '사건')
    end;
  end if;
end $$;

update public.write_permanent_cards
set type = case trim(type)
  when 'event' then '사건'
  when 'character' then '캐릭터'
  when 'worldview' then '세계관'
  when 'place' then '장소'
  else type
end
where trim(type) in ('event', 'character', 'worldview', 'place');

update public.write_permanent_cards
set type = '사건'
where type is null or trim(type) = '';

alter table public.write_permanent_cards
  drop column if exists card_type;

alter table public.write_permanent_cards
  alter column type set not null;

alter table public.write_permanent_cards
  add constraint write_permanent_cards_type_chk check (
    type in ('사건', '캐릭터', '세계관', '장소')
  );
