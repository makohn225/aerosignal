-- Approved by the owner November 22, 2026 ("Approved" to the three database changes).
-- 1. Faster class matching: an index on each accident's aircraft class, so brief_matches_v2, theme_stats_v2 and
--    accidents_near_route_v2 stop working out the class for all 30,000 events on every call. If ntsb_ac_class is
--    ever redefined, run: reindex index public.ntsb_events_ac_class;
create index if not exists ntsb_events_ac_class on public.ntsb_events (public.ntsb_ac_class(ntsb_events.*));
analyze public.ntsb_events;

-- 2. Accidents at the route's airports for a class ('light' as before, 'all', or one class)
create or replace function public.airport_reports_v2(codes text[], lim integer default 5, cls text default 'light')
returns table(ev_id text, accident_number text, event_date date, location text, airport_code text, model text, family text,
              injury_severity text, fatal integer, hfacs_label text, narrative text)
language sql stable set search_path to 'public' as $$
  select e.ev_id, e.accident_number, e.event_date, e.location, e.airport_code, e.model, e.family, e.injury_severity, e.fatal, n.hfacs_label, n.narrative
  from public.ntsb_events e join public.ntsb_narratives n using (ev_id)
  where upper(e.airport_code) = any(codes)
    and (cls = 'all' or (cls = 'light' and e.is_light_single) or public.ntsb_ac_class(e) = cls)
  order by e.event_date desc limit least(lim, 20);
$$;
grant execute on function public.airport_reports_v2(text[], integer, text) to anon, authenticated;

-- 3. Signed out visitors can no longer call the comment, review and admin lookups (each already refused them;
--    Supabase grants new functions to anon by default). airport_comments_for stays public: it lists approved comments.
revoke execute on function public.add_airport_comment(text, text), public.my_airport_comments(text), public.delete_my_airport_comment(bigint),
  public.pending_airport_comments(), public.review_airport_comment(bigint, boolean), public.is_app_admin() from anon;
