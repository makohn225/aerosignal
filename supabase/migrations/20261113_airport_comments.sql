-- Shared airport comments for p260. Approved by the owner November 13, 2026 ("Both": the table plus the demo re-record).
-- Adds only; nothing existing changes.
-- A signed in pilot writes a short comment about an airport (FBO service, ramp, local procedures, things to know).
-- Every comment starts as pending and nobody else sees it until an admin approves it in the feedback inbox.
-- Approved comments show without any name or account detail. A pilot can delete their own comments at any time.

create table if not exists public.airport_comments (
  id bigserial primary key,
  airport text not null check (airport ~ '^[A-Z0-9]{3,4}$'),
  body text not null check (char_length(body) between 3 and 500),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists airport_comments_airport on public.airport_comments (airport, status, created_at desc);
create index if not exists airport_comments_user on public.airport_comments (user_id, created_at desc);
alter table public.airport_comments enable row level security;
-- No direct table access; everything goes through the functions below.

create or replace function public.add_airport_comment(a text, body text)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare n int; new_id bigint; ap text := upper(regexp_replace(coalesce(a, ''), '[^A-Za-z0-9]', '', 'g')); b text := trim(coalesce(body, ''));
begin
  if auth.uid() is null then raise exception 'Sign in to post a comment'; end if;
  if char_length(b) < 3 then raise exception 'Write a few words first'; end if;
  if char_length(b) > 500 then raise exception 'Keep the comment to 500 characters'; end if;
  select count(*) into n from airport_comments where user_id = auth.uid() and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'You have posted 10 comments today. Try again tomorrow.'; end if;
  insert into airport_comments (airport, body) values (ap, b) returning id into new_id;
  return new_id;
end $$;

-- Approved comments for one airport, without names
create or replace function public.airport_comments_for(a text)
returns table (id bigint, body text, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.body, c.created_at from airport_comments c
  where c.status = 'approved' and c.airport = upper(regexp_replace(coalesce(a, ''), '[^A-Za-z0-9]', '', 'g'))
  order by c.created_at desc limit 40
$$;

-- The signed in pilot's own comments at one airport, with their review status
create or replace function public.my_airport_comments(a text)
returns table (id bigint, body text, status text, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.body, c.status, c.created_at from airport_comments c
  where auth.uid() is not null and c.user_id = auth.uid() and c.airport = upper(regexp_replace(coalesce(a, ''), '[^A-Za-z0-9]', '', 'g'))
  order by c.created_at desc limit 40
$$;

create or replace function public.delete_my_airport_comment(cid bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from airport_comments where id = cid and user_id = auth.uid();
  return found;
end $$;

-- Admin review queue (feedback inbox)
create or replace function public.pending_airport_comments()
returns table (id bigint, airport text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not coalesce(is_app_admin(), false) then raise exception 'Not allowed'; end if;
  return query select c.id, c.airport, c.body, c.created_at from airport_comments c where c.status = 'pending' order by c.created_at limit 200;
end $$;

create or replace function public.review_airport_comment(cid bigint, ok boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not coalesce(is_app_admin(), false) then raise exception 'Not allowed'; end if;
  update airport_comments set status = case when ok then 'approved' else 'rejected' end, reviewed_at = now() where id = cid;
  return found;
end $$;

revoke all on function public.add_airport_comment(text, text), public.airport_comments_for(text), public.my_airport_comments(text),
  public.delete_my_airport_comment(bigint), public.pending_airport_comments(), public.review_airport_comment(bigint, boolean) from public;
grant execute on function public.airport_comments_for(text) to anon, authenticated;
grant execute on function public.add_airport_comment(text, text), public.my_airport_comments(text), public.delete_my_airport_comment(bigint),
  public.pending_airport_comments(), public.review_airport_comment(bigint, boolean) to authenticated;
