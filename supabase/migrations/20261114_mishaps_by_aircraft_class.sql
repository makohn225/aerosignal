-- Accident matching by aircraft class and type (p268). Approved by the owner November 14, 2026.
-- Adds functions only; the existing brief_matches, theme_stats and accidents_near_route are unchanged and still
-- serve light single piston airplanes. No tables are added.

-- The class of an NTSB event, worked out from the public NTSB fields
create or replace function public.ntsb_ac_class(e public.ntsb_events)
returns text language sql immutable set search_path to 'public' as $$
  select case
    when e.is_light_single then 'light'
    when e.aircraft_category = 'Helicopter' then 'helo'
    when e.far_part ilike '%121%' then 'airline'
    when e.engine_type in ('Turbo Fan', 'Turbo Jet') and e.make ~* '(boeing|airbus|mcdonnell|douglas|lockheed)' then 'airline'
    when e.engine_type in ('Turbo Fan', 'Turbo Jet') then 'jet'
    when e.engine_type = 'Turbo Prop' then 'turboprop'
    when e.aircraft_category = 'Airplane' and e.engines = 2 and e.engine_type = 'Reciprocating' then 'twin'
    else 'other' end
$$;

-- Accident lessons for a theme from aircraft of the same class, the same type first
create or replace function public.brief_matches_v2(theme_keys text[], cls text, type_re text default null, per_theme integer default 3)
returns table(theme text, rnk integer, ev_id text, accident_number text, event_date date, location text, airport_code text, model text, family text,
              injury_severity text, fatal integer, weather_condition text, hfacs_label text, theme_sim double precision, profile_sim double precision, match integer, narrative text)
language sql stable set search_path to 'public', 'extensions' as $$
  with th as (select key, embedding, coalesce(threshold, 0.8) thr from public.themes where key = any(theme_keys) and embedding is not null),
  prof as materialized (select avg(embedding) v from th),
  pool as materialized (
    select e.ev_id, e.fatal > 0 fatal, n.embedding, coalesce(type_re is not null and type_re <> '' and e.model ~* type_re, false) same_type
    from public.ntsb_events e join public.ntsb_narratives n using (ev_id)
    where n.embedding is not null and public.ntsb_ac_class(e) = cls
  ),
  cand as (
    select th.key, th.thr, c.ev_id, c.ts, c.same_type, c.fatal
    from th cross join lateral (
      (select p.ev_id, (1 - (p.embedding <=> th.embedding))::float ts, p.same_type, p.fatal from pool p order by p.embedding <=> th.embedding limit 150)
      union
      (select p.ev_id, (1 - (p.embedding <=> th.embedding))::float ts, p.same_type, p.fatal from pool p where p.same_type order by p.embedding <=> th.embedding limit 40)
    ) c
  ),
  scored as (select c.*, 1 - (n.embedding <=> (select v from prof)) ps from cand c join public.ntsb_narratives n on n.ev_id = c.ev_id),
  ranked as (
    select s.*, row_number() over (partition by s.key order by
      s.ts + 0.5*s.ps + case when s.same_type then 0.06 else 0 end + case when s.fatal then 0.01 else 0 end
      + 0.01*greatest(0, extract(year from e.event_date) - 2008)/14 desc) r
    from scored s join public.ntsb_events e on e.ev_id = s.ev_id
  )
  select r.key, r.r::int, e.ev_id, e.accident_number, e.event_date, e.location, e.airport_code, e.model, e.family, e.injury_severity, e.fatal,
         e.weather_condition, n.hfacs_label, r.ts, r.ps,
         least(99, greatest(1, round(100 * (0.6*least(1, greatest(0, (r.ts - (r.thr - 0.08)) / 0.16)) + 0.4*least(1, greatest(0, (r.ps - 0.72) / 0.18))))))::int,
         n.narrative
  from ranked r join public.ntsb_events e on e.ev_id = r.ev_id join public.ntsb_narratives n on n.ev_id = r.ev_id
  where r.r <= least(per_theme, 10)
  order by r.key, r.r;
$$;

-- Counts behind each theme for the class: in_type is the pilot's type, other_light is the rest of the class
create or replace function public.theme_stats_v2(theme_keys text[], cls text, type_re text default null)
returns table(theme text, in_type integer, in_type_fatal integer, other_light integer, other_light_fatal integer, threshold double precision, embedded integer)
language sql stable set search_path to 'public', 'extensions' as $$
  with pool as materialized (
    select e.ev_id, e.fatal > 0 fatal, n.embedding, coalesce(type_re is not null and type_re <> '' and e.model ~* type_re, false) same_type
    from public.ntsb_events e join public.ntsb_narratives n using (ev_id)
    where n.embedding is not null and public.ntsb_ac_class(e) = cls
  )
  select th.key,
    count(*) filter (where p.same_type)::int, count(*) filter (where p.same_type and p.fatal)::int,
    count(*) filter (where p.ev_id is not null and not p.same_type)::int, count(*) filter (where p.ev_id is not null and not p.same_type and p.fatal)::int,
    th.threshold, (select count(*) from pool)::int
  from public.themes th
  left join pool p on 1 - (p.embedding <=> th.embedding) >= th.threshold
  where th.key = any(theme_keys)
  group by th.key, th.threshold;
$$;

-- Accidents along a route for a class ('light' as before, 'all', or one class)
create or replace function public.accidents_near_route_v2(lats double precision[], lons double precision[], corridor_nm double precision default 10, lim integer default 150, cls text default 'light')
returns table(ev_id text, accident_number text, event_date date, location text, airport_code text, lat double precision, lon double precision, model text, family text,
              fatal integer, injury_severity text, weather_condition text, hfacs_label text, dist_nm double precision, excerpt text)
language sql stable set search_path to 'public' as $$
  with seg as (
    select i, lats[i] la1, lons[i] lo1, coalesce(lats[i+1], lats[i]) la2, coalesce(lons[i+1], lons[i]) lo2
    from generate_subscripts(lats, 1) i
    where i < array_length(lats,1) or array_length(lats,1) = 1
  ),
  box as (select min(least(la1,la2)) - corridor_nm/60.0 mnla, max(greatest(la1,la2)) + corridor_nm/60.0 mxla,
                 min(least(lo1,lo2)) - corridor_nm/40.0 mnlo, max(greatest(lo1,lo2)) + corridor_nm/40.0 mxlo from seg),
  c as (
    select e.*, n.hfacs_label, n.narrative from public.ntsb_events e join public.ntsb_narratives n using (ev_id), box
    where (cls = 'all' or (cls = 'light' and e.is_light_single) or public.ntsb_ac_class(e) = cls)
      and e.latitude between box.mnla and box.mxla and e.longitude between box.mnlo and box.mxlo
  ),
  d as (
    select c.*, (select min(
        60 * sqrt(power((px - ax) - greatest(0, least(1, ((px-ax)*(bx-ax)+(py-ay)*(by-ay)) / nullif((bx-ax)^2+(by-ay)^2,0)))*(bx-ax), 2)
                + power((py - ay) - greatest(0, least(1, ((px-ax)*(bx-ax)+(py-ay)*(by-ay)) / nullif((bx-ax)^2+(by-ay)^2,0)))*(by-ay), 2)))
      from (select c.longitude*cos(radians(c.latitude)) px, c.latitude py,
                   s.lo1*cos(radians(c.latitude)) ax, s.la1 ay, s.lo2*cos(radians(c.latitude)) bx, s.la2 by from seg s) g
    ) dn from c
  )
  select ev_id, accident_number, event_date, location, airport_code, latitude, longitude, model, family, fatal, injury_severity,
         weather_condition, hfacs_label, round(coalesce(dn, 0)::numeric, 1)::double precision, left(narrative, 700)
  from d where coalesce(dn, 0) <= corridor_nm
  order by (fatal > 0) desc, event_date desc
  limit least(lim, 400)
$$;

grant execute on function public.brief_matches_v2(text[], text, text, integer), public.theme_stats_v2(text[], text, text),
  public.accidents_near_route_v2(double precision[], double precision[], double precision, integer, text) to anon, authenticated;

-- Applied the same day as two follow ups (migrations mishaps_by_aircraft_class_thresholds and themes_for_larger_aircraft):
-- 1. brief_matches_v2 and theme_stats_v2 work out each theme's threshold inside the class (95th percentile of
--    similarity, the same rule the light single thresholds use), and the same type bonus (0.05) applies only to
--    reports at or above that threshold.
-- 2. Eight themes added to public.themes for larger aircraft: turb, ground, unstab, engfail, bird, wire, lte, vmc,
--    embedded with gte-small through the embed function; stored threshold is the 95th percentile across non light
--    single reports. See the deployed functions for the final text.
