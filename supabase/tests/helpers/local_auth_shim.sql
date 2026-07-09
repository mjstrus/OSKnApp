-- ============================================================================
-- Shim WYŁĄCZNIE do lokalnych testów RLS na czystym Postgresie (bez Supabase).
-- Odtwarza minimum środowiska Supabase, od którego zależą migracje:
--   role anon/authenticated/service_role, schema auth z auth.users i auth.uid().
-- NIE uruchamiać na prawdziwym projekcie Supabase — tam to już istnieje.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Tak jak w Supabase: uid bieżącego użytkownika z claimów JWT.
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
