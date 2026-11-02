-- Instructor review of shared briefs (p165). Proposed November 2, 2026; apply only after the owner
-- approves it and its privacy sentence. Adds only; nothing existing changes.

alter table public.school_shares add column if not exists status text not null default 'submitted';
alter table public.school_shares add column if not exists review_note text;
alter table public.school_shares add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.school_shares add column if not exists reviewed_at timestamptz;
do $$ begin
  alter table public.school_shares add constraint school_shares_status_chk check (status in ('submitted','approved','returned'));
exception when duplicate_object then null; end $$;

create table if not exists public.school_reviews (
  id bigint generated always as identity primary key,
  share_id bigint not null references public.school_shares(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  by_user uuid references auth.users(id) on delete set null,
  status text not null check (status in ('submitted','approved','returned')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists school_reviews_share_idx on public.school_reviews (share_id, created_at desc);
alter table public.school_reviews enable row level security;
drop policy if exists reviews_read on public.school_reviews;
create policy reviews_read on public.school_reviews for select
  using (student_id = auth.uid() or public.is_school_instructor(school_id));
-- No insert, update or delete policies: rows are written only by the functions below.

-- Students may change what they shared, but never the review fields; a change to the plan itself
-- sends an approved or returned brief back to "submitted" and records that in the history.
create or replace function public.school_share_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if current_setting('aero.review', true) = 'on' then return new; end if;
  if new.status is distinct from old.status or new.review_note is distinct from old.review_note
     or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then
    new.status := old.status; new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  end if;
  if (new.route, new.dep_at, new.verdict, new.reasons) is distinct from (old.route, old.dep_at, old.verdict, old.reasons)
     and old.status <> 'submitted' then
    new.status := 'submitted'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    insert into public.school_reviews (share_id, school_id, student_id, by_user, status, note)
      values (new.id, new.school_id, new.user_id, auth.uid(), 'submitted', 'Changed after review and shared again');
  end if;
  return new;
end $$;
drop trigger if exists school_share_guard on public.school_shares;
create trigger school_share_guard before update on public.school_shares for each row execute function public.school_share_guard();

create or replace function public.school_share_new()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.status := 'submitted'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;
drop trigger if exists school_share_new on public.school_shares;
create trigger school_share_new before insert on public.school_shares for each row execute function public.school_share_new();

-- An instructor approves or returns a shared brief, with an optional comment.
create or replace function public.review_share(p_share bigint, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare s public.school_shares;
begin
  if p_status not in ('approved','returned') then raise exception 'Status must be approved or returned'; end if;
  select * into s from public.school_shares where id = p_share;
  if s.id is null or not public.is_school_instructor(s.school_id) then raise exception 'Only the school''s instructors can review this brief'; end if;
  perform set_config('aero.review', 'on', true);
  update public.school_shares set status = p_status, review_note = left(nullif(trim(p_note), ''), 1000), reviewed_by = auth.uid(), reviewed_at = now() where id = p_share;
  perform set_config('aero.review', 'off', true);
  insert into public.school_reviews (share_id, school_id, student_id, by_user, status, note)
    values (s.id, s.school_id, s.user_id, auth.uid(), p_status, left(nullif(trim(p_note), ''), 1000));
end $$;

revoke all on function public.review_share(bigint, text, text) from public, anon;
grant execute on function public.review_share(bigint, text, text) to authenticated;
revoke all on function public.school_share_guard() from public, anon, authenticated;
revoke all on function public.school_share_new() from public, anon, authenticated;
