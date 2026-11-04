-- Student side of the school traffic picture (p176). NOT APPLIED: waiting for the owner's approval of this
-- change and its privacy sentence. Adds one read only function; nothing existing changes.
-- Any member of a school (student or instructor) can see how many shared school flights depart in each hour of
-- the next two days and their routes' airports, as counts only: no names, no user ids, no flight details.

create or replace function public.school_traffic(s uuid)
returns table (route text, dep_hour timestamptz, flights int)
language sql stable security definer set search_path to 'public' as $$
  select sh.route, date_trunc('hour', sh.dep_at) as dep_hour, count(*)::int as flights
  from school_shares sh
  where sh.school_id = s
    and exists (select 1 from school_members m where m.school_id = s and m.user_id = auth.uid())
    and sh.dep_at between now() - interval '2 hours' and now() + interval '48 hours'
  group by sh.route, date_trunc('hour', sh.dep_at)
$$;

revoke all on function public.school_traffic(uuid) from public, anon;
grant execute on function public.school_traffic(uuid) to authenticated;
