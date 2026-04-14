alter table public.write_projects
  add column if not exists worldview_context text;
