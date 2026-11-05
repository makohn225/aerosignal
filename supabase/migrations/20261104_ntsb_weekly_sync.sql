-- Approved by the owner November 4, 2026 and applied: load each new NTSB weekly update file (data.ntsb.gov/avdata)
-- through the ntsbsync edge function on the 2nd, 9th, 16th and 23rd of each month (the files are posted on the 1st, 8th, 15th and 22nd).
create or replace function private.ntsb_weekly(day_override int default null)
returns bigint language sql security definer set search_path to 'private', 'extensions', 'net' as $$
  select net.http_post(
    url := 'https://jcvrcckeprmpcruhxafm.supabase.co/functions/v1/ntsbsync',
    body := jsonb_build_object('mode', 'mdb', 'file',
      'up' || lpad((case when d >= 22 then 22 when d >= 15 then 15 when d >= 8 then 8 else 1 end)::text, 2, '0')
      || upper(to_char(now() at time zone 'utc', 'MON')) || '.zip'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', (select value from private.config where key = 'ingest_token')),
    timeout_milliseconds := 140000)
  from (select coalesce(day_override, extract(day from now() at time zone 'utc')::int) d) x;
$$;
revoke all on function private.ntsb_weekly(int) from public, anon, authenticated;
select cron.schedule('vigilyn-ntsb-weekly', '40 8 2,9,16,23 * *', $c$ select private.ntsb_weekly() $c$);
