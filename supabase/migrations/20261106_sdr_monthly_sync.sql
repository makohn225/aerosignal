-- Approved by the owner November 6, 2026 and applied: refresh this year's FAA Service Difficulty Reports (and last
-- year's in January) through the sdrsync edge function, one 2.5 MB slice per request, on the 3rd of each month.
create or replace function private.sdr_monthly()
returns int language sql security definer set search_path to 'private', 'extensions', 'net' as $$
  select count(net.http_post(
    url := 'https://jcvrcckeprmpcruhxafm.supabase.co/functions/v1/sdrsync',
    body := jsonb_build_object('year', y, 'offset', o, 'span', 2500000),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', (select value from private.config where key = 'ingest_token')),
    timeout_milliseconds := 140000))::int
  from (select extract(year from now() at time zone 'utc')::int y
        union select extract(year from now() at time zone 'utc')::int - 1 where extract(month from now() at time zone 'utc') = 1) ys,
       generate_series(0, 42500000, 2500000) o;
$$;
revoke all on function private.sdr_monthly() from public, anon, authenticated;
select cron.schedule('vigilyn-sdr-monthly', '10 9 3 * *', $c$ select private.sdr_monthly() $c$);
