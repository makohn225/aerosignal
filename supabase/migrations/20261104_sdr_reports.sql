-- Approved by the owner November 4, 2026 and applied. FAA Service Difficulty Reports (public, faa.gov/av-info/download_SDR)
-- for general aviation makes, loaded by the sdrsync edge function, for the brief's "Known issues for this aircraft type"
-- panel (p183). Public data only; nothing about users is stored. Adds only; nothing existing changes.
create table if not exists public.sdr_reports (
  id text primary key,
  difficulty_date date,
  jasc text,
  make text,
  model text,
  model_norm text,
  part_name text,
  part_condition text,
  part_location text,
  stage text,
  discrepancy text,
  loaded_at timestamptz not null default now()
);
create index if not exists sdr_reports_make_model on public.sdr_reports (make, model_norm text_pattern_ops);
create index if not exists sdr_reports_date on public.sdr_reports (difficulty_date desc);
alter table public.sdr_reports enable row level security;

create or replace function public.sdr_summary(mk text, md text, yrs int default 5)
returns json language sql stable security definer set search_path to 'public' as $$
  with f as (
    select * from sdr_reports
    where make like upper(split_part(trim(mk), ' ', 1)) || '%'
      and model_norm like upper(regexp_replace(coalesce(md, ''), '[^A-Za-z0-9]', '', 'g')) || '%'
      and difficulty_date >= (current_date - make_interval(years => least(greatest(coalesce(yrs, 5), 1), 10)))
  )
  select json_build_object(
    'total', (select count(*) from f),
    'since', (select min(difficulty_date) from f),
    'systems', (select coalesce(json_agg(x), '[]') from (select left(jasc, 2) ch, count(*)::int n from f where jasc ~ '^[0-9]{2}' group by 1 order by 2 desc limit 8) x),
    'parts', (select coalesce(json_agg(x), '[]') from (select initcap(part_name) part, count(*)::int n, mode() within group (order by initcap(part_condition)) cond from f where coalesce(part_name, '') <> '' group by 1 order by 2 desc limit 8) x),
    'recent', (select coalesce(json_agg(x), '[]') from (select difficulty_date d, model, initcap(part_name) part, left(discrepancy, 400) text from f where coalesce(discrepancy, '') <> '' order by difficulty_date desc limit 5) x)
  )
$$;
revoke all on function public.sdr_summary(text, text, int) from public;
grant execute on function public.sdr_summary(text, text, int) to anon, authenticated;
