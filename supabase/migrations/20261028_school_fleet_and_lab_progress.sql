-- School fleet saved with the school, and optional planning lab progress shared by each student.
-- Approved by the owner on October 28, 2026 (privacy sentence in p161). Adds only; nothing existing changes.

alter table public.schools add column if not exists fleet jsonb;
alter table public.schools add column if not exists fleet_at timestamptz;
alter table public.school_members add column if not exists lab jsonb;
alter table public.school_members add column if not exists lab_at timestamptz;

-- Instructors (or the owner) save the fleet. Members already read the school row (schools_member_read).
create or replace function public.set_school_fleet(s uuid, f jsonb)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare t timestamptz := now();
begin
  if auth.uid() is null or not public.is_school_instructor(s) then raise exception 'Only the school''s instructors can change its fleet'; end if;
  if f is not null and octet_length(f::text) > 200000 then raise exception 'The fleet is too large to save'; end if;
  update public.schools set fleet = f, fleet_at = case when f is null then null else t end where id = s;
  return t;
end $$;

-- A student shares (or with null, stops sharing) their own lesson progress with one school.
-- Read by the student and the school's instructors through members_self_read.
create or replace function public.share_lab_progress(s uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p is not null and octet_length(p::text) > 20000 then raise exception 'Progress is too large'; end if;
  update public.school_members set lab = p, lab_at = case when p is null then null else now() end
    where school_id = s and user_id = auth.uid();
end $$;

revoke all on function public.set_school_fleet(uuid, jsonb) from public, anon;
revoke all on function public.share_lab_progress(uuid, jsonb) from public, anon;
grant execute on function public.set_school_fleet(uuid, jsonb) to authenticated;
grant execute on function public.share_lab_progress(uuid, jsonb) to authenticated;
