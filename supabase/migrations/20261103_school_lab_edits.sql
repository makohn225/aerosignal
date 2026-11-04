-- School edits of the planning lab check questions and school notes (p167). Approved by the owner and
-- applied November 3, 2026, with its privacy sentence. Adds only; nothing existing changes.
-- Members already read the school row (schools_member_read); only instructors write, through the function.

alter table public.schools add column if not exists lab jsonb;
alter table public.schools add column if not exists lab_at timestamptz;

create or replace function public.set_school_lab(s uuid, l jsonb)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare t timestamptz := now();
begin
  if auth.uid() is null or not public.is_school_instructor(s) then raise exception 'Only the school''s instructors can change its lessons'; end if;
  if l is not null and octet_length(l::text) > 100000 then raise exception 'The lesson edits are too large to save'; end if;
  update public.schools set lab = l, lab_at = case when l is null then null else t end where id = s;
  return t;
end $$;

revoke all on function public.set_school_lab(uuid, jsonb) from public, anon;
grant execute on function public.set_school_lab(uuid, jsonb) to authenticated;
