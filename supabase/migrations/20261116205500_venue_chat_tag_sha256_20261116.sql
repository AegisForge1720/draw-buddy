-- Venue chat follow-up: author tag = first 10 hex of sha256(device id) so the device can recognize its own
-- messages without reading raw device ids; rate-limit errors return 400 (P0001) instead of 500.
-- (set by the insert trigger; a generated column can't use sha256 since convert_to isn't immutable)
alter table public.venue_messages drop column author_tag;
alter table public.venue_messages add column author_tag text;
update public.venue_messages set author_tag = left(encode(sha256(convert_to(device_id::text, 'UTF8')), 'hex'), 10);
alter table public.venue_messages alter column author_tag set not null;
grant select (author_tag) on public.venue_messages to anon, authenticated;

create or replace function private.venue_messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.body := btrim(new.body);
  new.display_name := btrim(new.display_name);
  new.author_tag := left(encode(sha256(convert_to(new.device_id::text, 'UTF8')), 'hex'), 10);
  new.created_at := now(); new.expires_at := now() + interval '24 hours'; new.report_count := 0; new.hidden := false;
  if private.venue_name_blocked(new.display_name) then raise exception 'display name not allowed' using errcode = '22023'; end if;
  if private.venue_text_blocked(new.body) then raise exception 'message not allowed' using errcode = '22023'; end if;
  if new.body ~* '\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}|\d{10}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' then raise exception 'no personal info (phone numbers or emails)' using errcode = '22023'; end if;
  if exists (select 1 from public.venue_messages m where m.device_id = new.device_id and m.created_at > now() - interval '3 seconds') then
    raise exception 'slow down: one message every 3 seconds' using errcode = 'P0001'; end if;
  if (select count(*) from public.venue_messages m where m.device_id = new.device_id and m.created_at > now() - interval '1 minute') >= 6 then
    raise exception 'slow down: 6 messages a minute' using errcode = 'P0001'; end if;
  if (select count(*) from public.venue_messages m where m.venue_id = new.venue_id and m.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'venue chat is busy, try again in a minute' using errcode = 'P0001'; end if;
  delete from public.venue_messages where expires_at < now();
  return new;
end $$;
revoke all on function private.venue_messages_before_insert() from public, anon, authenticated;
