-- Approved by the owner November 8, 2026 and applied: "Your feedback" status in the app (p191).
-- client_token: a random id the submitting device creates and keeps, so only that device can look its feedback up.
-- reply: a short answer written for the tester (admin_note stays internal).
alter table public.feedback add column if not exists client_token uuid;
alter table public.feedback add column if not exists reply text check (reply is null or char_length(reply) <= 1000);
create index if not exists feedback_client_token on public.feedback (client_token) where client_token is not null;

create or replace function public.my_feedback(tokens uuid[])
returns table (id bigint, created_at timestamptz, kind text, message text, status text, reply text, updated_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select f.id, f.created_at, f.kind, left(f.message, 240), f.status, f.reply, f.updated_at
  from feedback f
  where f.client_token is not null and f.client_token = any (tokens[1:50])
  order by f.created_at desc
$$;
revoke all on function public.my_feedback(uuid[]) from public;
grant execute on function public.my_feedback(uuid[]) to anon, authenticated;
