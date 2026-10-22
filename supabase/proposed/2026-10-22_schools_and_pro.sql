-- PROPOSED, NOT APPLIED. Needs the owner's approval before it runs (database schema change).
-- Flight school dashboard and the Pro subscription switch.
--
-- Schools: an instructor creates a school and shares a join code. A student who joins can choose,
-- flight by flight, to share the brief summary (route, departure time, verdict and reasons) and the
-- approach debrief summary with the school. Nothing is shared without that choice, and a student can
-- leave a school at any time, which removes their shared rows.
--
-- Pro: one row per user saying which plan they have and until when. Only the server (a payment
-- webhook using the service role) writes it; users can read their own row. While no payments are
-- live, nobody has a row and every feature stays free.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner uuid not null references auth.users(id) on delete cascade,
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.school_members (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('instructor', 'student')),
  joined_at timestamptz not null default now(),
  primary key (school_id, user_id)
);

create table public.school_shares (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  flight_id text not null,
  route text,
  dep_at timestamptz,
  verdict text check (verdict in ('GO', 'CAUTION', 'NO GO')),
  reasons jsonb,          -- short reason lines from the verdict, no free text from the logbook
  debrief jsonb,          -- approach debrief summary: runway, gates, stable or not
  created_at timestamptz not null default now(),
  unique (school_id, user_id, flight_id)
);
create index on public.school_shares (school_id, created_at desc);

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'school')),
  source text,            -- 'apple', 'google', 'stripe', 'manual'
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.school_shares enable row level security;
alter table public.entitlements enable row level security;

-- helper: is the caller an instructor of this school
create or replace function public.is_school_instructor(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_members m where m.school_id = s and m.user_id = auth.uid() and m.role = 'instructor')
     or exists (select 1 from public.schools k where k.id = s and k.owner = auth.uid());
$$;

-- schools: owners manage; members can read their school's name
create policy schools_owner_all on public.schools for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy schools_member_read on public.schools for select using (exists (select 1 from public.school_members m where m.school_id = schools.id and m.user_id = auth.uid()));

-- members: a user sees their own memberships; instructors see their school's roster; a user can leave
create policy members_self_read on public.school_members for select using (user_id = auth.uid() or public.is_school_instructor(school_id));
create policy members_self_delete on public.school_members for delete using (user_id = auth.uid() or public.is_school_instructor(school_id));
-- joining happens through a security definer function that checks the join code (not a direct insert)

-- shares: a student writes and deletes their own; instructors read their school's
create policy shares_own_write on public.school_shares for insert with check (user_id = auth.uid() and exists (select 1 from public.school_members m where m.school_id = school_shares.school_id and m.user_id = auth.uid()));
create policy shares_own_update on public.school_shares for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shares_own_delete on public.school_shares for delete using (user_id = auth.uid());
create policy shares_read on public.school_shares for select using (user_id = auth.uid() or public.is_school_instructor(school_id));

-- entitlements: read your own; no client writes
create policy ent_read_own on public.entitlements for select using (user_id = auth.uid());

-- join a school by code
create or replace function public.join_school(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  select id into s from public.schools where join_code = upper(trim(code));
  if s is null then raise exception 'No school with that code'; end if;
  insert into public.school_members (school_id, user_id, role) values (s, auth.uid(), 'student')
    on conflict (school_id, user_id) do nothing;
  return s;
end $$;
revoke all on function public.join_school(text) from public;
grant execute on function public.join_school(text) to authenticated;

-- leaving a school removes what the student shared with it
create or replace function public.school_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.school_shares where school_id = old.school_id and user_id = old.user_id;
  return old;
end $$;
create trigger school_member_left after delete on public.school_members for each row execute function public.school_member_left();
