-- Pilot airport reports for p175 ("Waze for pilots"). NOT APPLIED: waiting for the owner's approval of this
-- change and its privacy sentence. Adds only; nothing existing changes.
-- A signed in pilot posts a short report about an airport (pattern busy, runway in use, birds, fuel out,
-- taxi delay, other). Other pilots see it without any name or account detail for 90 minutes. Rows older
-- than 30 days are deleted whenever a new report is added.

create table if not exists public.airport_reports (
  id bigserial primary key,
  airport text not null check (airport ~ '^[A-Z0-9]{3,4}$'),
  kind text not null check (kind in ('busy', 'runway', 'birds', 'fuel', 'taxi', 'other')),
  detail text check (detail is null or char_length(detail) <= 140),
  runway text check (runway is null or runway ~ '^[0-9]{1,2}[LCR]?$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 minutes'
);
create index if not exists airport_reports_airport_time on public.airport_reports (airport, expires_at desc);
alter table public.airport_reports enable row level security;
-- No direct table access; everything goes through the two functions below.
revoke all on public.airport_reports from public, anon, authenticated;

create or replace function public.add_airport_report(a text, k text, d text default null, rw text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare n int; new_id bigint; ap text := upper(regexp_replace(coalesce(a, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Sign in to post a report'; end if;
  select count(*) into n from airport_reports where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if n >= 10 then raise exception 'You have posted 10 reports in the last hour. Try again later.'; end if;
  delete from airport_reports where created_at < now() - interval '30 days';
  insert into airport_reports (airport, kind, detail, runway) values (ap, k, nullif(trim(d), ''), nullif(upper(trim(rw)), '')) returning id into new_id;
  return new_id;
end $$;

create or replace function public.recent_airport_reports(ids text[])
returns table (airport text, kind text, detail text, runway text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select r.airport, r.kind, r.detail, r.runway, r.created_at, r.expires_at
  from airport_reports r
  where r.expires_at > now() and r.airport = any (select upper(x) from unnest(ids) x)
  order by r.created_at desc limit 50
$$;

revoke all on function public.add_airport_report(text, text, text, text) from public, anon;
grant execute on function public.add_airport_report(text, text, text, text) to authenticated;
revoke all on function public.recent_airport_reports(text[]) from public;
grant execute on function public.recent_airport_reports(text[]) to anon, authenticated;
