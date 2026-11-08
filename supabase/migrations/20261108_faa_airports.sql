-- Approved by the owner November 8, 2026 and applied (as faa_airports and faa_airports_weekly): FAA NASR airport
-- data (public, 28 day cycle) for fuel, public or private use, tower and attendance, loaded by the nasrapt edge
-- function and refreshed weekly. Adds only; nothing existing changes.
create table if not exists public.faa_airports (
  site_no text primary key, arpt_id text not null, icao_id text, ident text not null, site_type text, name text, city text,
  state text, lat double precision, lon double precision, elev_ft double precision, ownership text, facility_use text,
  status text, fuel_types text, twr_type text, lgt_sked text, other_services text, attendance text, cycle date,
  loaded_at timestamptz not null default now()
);
create index if not exists faa_airports_ident on public.faa_airports (ident);
create index if not exists faa_airports_arpt on public.faa_airports (arpt_id);
create index if not exists faa_airports_ll on public.faa_airports (lat, lon);
alter table public.faa_airports enable row level security;

create or replace function public.faa_airport(code text)
returns setof public.faa_airports language sql stable security definer set search_path to 'public' as $$
  select * from faa_airports
  where ident = upper(trim(code)) or icao_id = upper(trim(code)) or arpt_id = upper(trim(code))
     or (length(trim(code)) = 4 and upper(trim(code)) like 'K%' and arpt_id = substr(upper(trim(code)), 2))
  order by (ident = upper(trim(code))) desc limit 1
$$;
create or replace function public.faa_airports_box(min_lat double precision, min_lon double precision, max_lat double precision, max_lon double precision, public_only boolean default true)
returns table (ident text, name text, city text, state text, lat double precision, lon double precision, elev_ft double precision, facility_use text, fuel_types text, twr_type text, attendance text, site_type text)
language sql stable security definer set search_path to 'public' as $$
  select ident, name, city, state, lat, lon, elev_ft, facility_use, fuel_types, twr_type, attendance, site_type
  from faa_airports
  where lat between min_lat and max_lat and lon between min_lon and max_lon
    and coalesce(status, 'O') = 'O' and site_type = 'A'
    and (not public_only or facility_use = 'PU')
  limit 4000
$$;
revoke all on function public.faa_airport(text) from public;
revoke all on function public.faa_airports_box(double precision, double precision, double precision, double precision, boolean) from public;
grant execute on function public.faa_airport(text) to anon, authenticated;
grant execute on function public.faa_airports_box(double precision, double precision, double precision, double precision, boolean) to anon, authenticated;

create or replace function private.nasr_apt()
returns bigint language sql security definer set search_path to 'private', 'extensions', 'net' as $$
  select net.http_post(url := 'https://jcvrcckeprmpcruhxafm.supabase.co/functions/v1/nasrapt', body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', (select value from private.config where key = 'ingest_token')),
    timeout_milliseconds := 140000);
$$;
revoke all on function private.nasr_apt() from public, anon, authenticated;
select cron.schedule('vigilyn-faa-airports-weekly', '25 9 * * 5', $c$ select private.nasr_apt() $c$);
