-- Draw Buddy private preview: Venue chat (Andrew approved 2026-11-16 3:37 PM ET).
-- No accounts, no email: each device sends a random device id (x-db-device header) and the venue it is
-- checked in to (x-db-venue header). RLS only lets a request read/write rows for the venue in its header.
-- Raw device ids are never readable by the API (column grants); readers see a short author tag instead.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.venue_messages (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null check (venue_id ~ '^[0-9A-Za-z_-]{1,40}$'),
  device_id uuid not null,
  author_tag text generated always as (left(md5(device_id::text), 10)) stored,
  display_name text not null check (char_length(display_name) between 2 and 20),
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  report_count integer not null default 0,
  hidden boolean not null default false
);
create index venue_messages_venue_created_idx on public.venue_messages (venue_id, created_at desc);
create index venue_messages_device_created_idx on public.venue_messages (device_id, created_at desc);
create index venue_messages_expires_idx on public.venue_messages (expires_at);

create table public.venue_message_reports (
  message_id uuid not null references public.venue_messages(id) on delete cascade,
  device_id uuid not null,
  venue_id text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, device_id)
);

alter table public.venue_messages enable row level security;
alter table public.venue_message_reports enable row level security;

-- Header helpers (PostgREST puts request headers in request.headers).
create or replace function private.req_header(name text) returns text
language sql stable set search_path = '' as $$
  select nullif(coalesce(current_setting('request.headers', true), '{}')::json ->> name, '')
$$;
grant usage on schema private to anon, authenticated;
grant execute on function private.req_header(text) to anon, authenticated;

-- Grants: read only safe columns; insert only the four user columns; no update/delete.
revoke all on public.venue_messages from anon, authenticated;
revoke all on public.venue_message_reports from anon, authenticated;
grant select (id, venue_id, author_tag, display_name, body, created_at, expires_at) on public.venue_messages to anon, authenticated;
grant insert (venue_id, device_id, display_name, body) on public.venue_messages to anon, authenticated;
grant insert (message_id, device_id, venue_id) on public.venue_message_reports to anon, authenticated;

create policy venue_messages_read_own_venue on public.venue_messages for select to anon, authenticated
  using (venue_id = private.req_header('x-db-venue') and not hidden and expires_at > now());
create policy venue_messages_post_own_venue on public.venue_messages for insert to anon, authenticated
  with check (venue_id = private.req_header('x-db-venue') and device_id::text = private.req_header('x-db-device')
              and report_count = 0 and hidden = false);
create policy venue_reports_own_venue on public.venue_message_reports for insert to anon, authenticated
  with check (venue_id = private.req_header('x-db-venue') and device_id::text = private.req_header('x-db-device'));

-- Server-side rules on every new message: text filter, name rules, rate limits, 24 h cleanup.
create or replace function private.venue_text_blocked(t text) returns boolean
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]+', ' ', 'g')) ~
    '(^| )(fuck\w*|shit\w*|cunt\w*|bitch\w*|asshole\w*|nigg\w*|fag\w*|faggot\w*|retard\w*|kike\w*|spic\w*|chink\w*|tranny\w*|whore\w*|slut\w*)( |$)'
$$;
create or replace function private.venue_name_blocked(n text) returns boolean
language sql immutable set search_path = '' as $$
  select private.venue_text_blocked(n)
      or lower(regexp_replace(coalesce(n, ''), '[^A-Za-z0-9]+', '', 'g')) ~ '(official|lottery|nylottery|draw.?budd|admin|moderator|mod$|staff|support|gaming ?commission)'
      or n !~ '^[A-Za-z0-9 _.-]{2,20}$'
$$;
create or replace function private.venue_messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.body := btrim(new.body);
  new.display_name := btrim(new.display_name);
  new.created_at := now(); new.expires_at := now() + interval '24 hours'; new.report_count := 0; new.hidden := false;
  if private.venue_name_blocked(new.display_name) then raise exception 'display name not allowed' using errcode = '22023'; end if;
  if private.venue_text_blocked(new.body) then raise exception 'message not allowed' using errcode = '22023'; end if;
  if new.body ~* '\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}|\d{10}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' then raise exception 'no personal info (phone numbers or emails)' using errcode = '22023'; end if;
  if exists (select 1 from public.venue_messages m where m.device_id = new.device_id and m.created_at > now() - interval '3 seconds') then
    raise exception 'slow down: one message every 3 seconds' using errcode = '53400'; end if;
  if (select count(*) from public.venue_messages m where m.device_id = new.device_id and m.created_at > now() - interval '1 minute') >= 6 then
    raise exception 'slow down: 6 messages a minute' using errcode = '53400'; end if;
  if (select count(*) from public.venue_messages m where m.venue_id = new.venue_id and m.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'venue chat is busy, try again in a minute' using errcode = '53400'; end if;
  delete from public.venue_messages where expires_at < now();
  return new;
end $$;
create trigger venue_messages_before_insert before insert on public.venue_messages
  for each row execute function private.venue_messages_before_insert();

-- Reports: must point at a message in the same venue; 3 reports from different devices hide it for everyone.
create or replace function private.venue_reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.venue_messages m where m.id = new.message_id and m.venue_id = new.venue_id) then
    raise exception 'message not found in this venue' using errcode = '22023'; end if;
  if (select count(*) from public.venue_message_reports r where r.device_id = new.device_id and r.created_at > now() - interval '1 minute') > 10 then
    raise exception 'too many reports, try again in a minute' using errcode = '53400'; end if;
  select count(*) into n from public.venue_message_reports r where r.message_id = new.message_id;
  update public.venue_messages set report_count = n, hidden = (n >= 3) where id = new.message_id;
  return new;
end $$;
create trigger venue_reports_after_insert after insert on public.venue_message_reports
  for each row execute function private.venue_reports_after_insert();

revoke all on function private.venue_messages_before_insert() from public, anon, authenticated;
revoke all on function private.venue_reports_after_insert() from public, anon, authenticated;
