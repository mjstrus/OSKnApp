-- ============================================================================
-- #1: nic w schemacie nie trzeba dodawać dla ręcznej korekty grafiku — RLS
-- admina na `slot` (update/delete) już istnieje z 0003. Tylko frontend.
-- #2: audit log akcji admina — kto i kiedy zatwierdził/usunął.
-- #3: przypomnienia e-mail o jeździe w ciągu 24h — pg_cron + pg_net woła
-- Edge Function send-reminders co godzinę; flaga na slocie pilnuje duplikatów.
-- ============================================================================

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  admin_user_id uuid not null default auth.uid() references auth.users (id) on delete set null,
  akcja text not null,
  szczegoly jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_osk_idx on admin_audit_log (osk_id, created_at desc);

alter table admin_audit_log enable row level security;
create policy admin_audit_log_insert on admin_audit_log
  for insert to authenticated with check (public.is_admin_of(osk_id));
create policy admin_audit_log_select on admin_audit_log
  for select using (public.is_admin_of(osk_id));

alter table slot add column przypomnienie_wyslano boolean not null default false;

create extension if not exists pg_net;

select cron.schedule(
  'wyslij-przypomnienia-jazd',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://qlpqmkqbimdwokeofyqq.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
