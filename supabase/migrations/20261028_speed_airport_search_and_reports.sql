-- Approved by the owner on October 28, 2026 (the two speedups proposed by the regular chat).
-- airport_reports filters on upper(airport_code) for light singles; the plain airport_code index was not used.
create index if not exists ntsb_events_upper_airport_ls_idx on public.ntsb_events (upper(airport_code)) where is_light_single;
-- search_airports matches names with ilike '%q%'; a trigram index lets that use an index instead of reading all 72,000 airports.
create extension if not exists pg_trgm with schema extensions;
create index if not exists airports_name_trgm_idx on public.airports using gin (name extensions.gin_trgm_ops);
create index if not exists airports_muni_trgm_idx on public.airports using gin (municipality extensions.gin_trgm_ops);
-- Measured after: airport_reports about 2 s to 36 ms; search_airports about 0.8 s to 0.3 s.
