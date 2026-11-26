-- November 26, 2026 (approved by Mario Nov 25: "Do all of them please, it is all approved").
-- Second level HFACS labels for NTSB narratives (Shappell and Wiegmann, DOT/FAA/AM-00/7), assigned automatically
-- from the narrative wording. Probable cause wording counts first. Not NTSB findings; the app says so.
-- Part 1 (applied Nov 26): public.hfacs_l2_of(text) returns text[]; see the function in the database for the rules.
-- Part 2: columns, trigger for new reports, and the backfill.
alter table public.ntsb_narratives add column if not exists hfacs_l2 text, add column if not exists hfacs_l2_all text[];
comment on column public.ntsb_narratives.hfacs_l2 is 'Second level HFACS category (Shappell and Wiegmann, DOT/FAA/AM-00/7), assigned automatically from the narrative wording; probable cause wording counts first. Not an NTSB finding.';
create or replace function public.ntsb_narratives_hfacs_l2() returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.hfacs_l2_all := public.hfacs_l2_of(new.narrative);
  new.hfacs_l2 := new.hfacs_l2_all[1];
  return new;
end $$;
drop trigger if exists ntsb_narratives_hfacs_l2 on public.ntsb_narratives;
create trigger ntsb_narratives_hfacs_l2 before insert or update of narrative on public.ntsb_narratives
  for each row execute function public.ntsb_narratives_hfacs_l2();
revoke execute on function public.ntsb_narratives_hfacs_l2() from public, anon, authenticated;
-- Backfill in batches (run separately): update public.ntsb_narratives set hfacs_l2_all = public.hfacs_l2_of(narrative), hfacs_l2 = (public.hfacs_l2_of(narrative))[1] where ...
