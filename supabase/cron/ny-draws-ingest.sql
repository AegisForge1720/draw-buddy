-- Recreated from the live prediction_logs project (kcvtuzadkyripylluqlj)
-- on 2026-11-14. The jobs below are already scheduled in production; do
-- not apply this file blindly or it may create duplicate cron jobs.
--
-- Required extensions: pg_cron, pg_net, supabase_vault.
-- Required Vault secret (create separately; never commit the value):
--   ny_draws_ingest_token
-- The Edge Function also uses the built-in SUPABASE_DB_URL environment
-- variable. Callers must send header x-ingest-token equal to that secret.

create schema if not exists ingest;

create table if not exists ingest.runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  game text not null,
  trigger text,
  source_url text,
  fetched integer,
  inserted integer,
  updated integer,
  skipped_invalid integer,
  max_key bigint,
  status text not null default 'running',
  error text
);

comment on table ingest.runs is
  'One row per game per invocation of the ny-draws-ingest Edge Function. Source is data.ny.gov only; the function never generates numbers.';

alter table ingest.runs enable row level security;

revoke all on table ingest.runs from public, anon, authenticated, service_role;
revoke usage on schema ingest from public, anon, authenticated, service_role;

create or replace function ingest.invoke_ny_draws(p_body jsonb)
returns bigint
language sql
set search_path to ''
as $function$
  select net.http_post(
    url := 'https://kcvtuzadkyripylluqlj.supabase.co/functions/v1/ny-draws-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-token', (select decrypted_secret from vault.decrypted_secrets where name = 'ny_draws_ingest_token')),
    body := p_body,
    timeout_milliseconds := 120000);
$function$;

revoke all on function ingest.invoke_ny_draws(jsonb) from public, anon, authenticated, service_role;
grant execute on function ingest.invoke_ny_draws(jsonb) to postgres;

-- Active production schedules (already installed):
--   ny-draws-quickdraw  */4 * * * *     every 4 minutes
--   ny-draws-big-games  40 */4 * * *    minute 40 of every 4th hour
--
-- Uncomment only when scheduling on a fresh database:
-- select cron.schedule(
--   'ny-draws-quickdraw',
--   '*/4 * * * *',
--   $cmd$select ingest.invoke_ny_draws('{"games":["quickdraw"],"trigger":"cron-quickdraw"}'::jsonb)$cmd$
-- );
-- select cron.schedule(
--   'ny-draws-big-games',
--   '40 */4 * * *',
--   $cmd$select ingest.invoke_ny_draws('{"games":["powerball","megamillions"],"trigger":"cron-big-games"}'::jsonb)$cmd$
-- );
