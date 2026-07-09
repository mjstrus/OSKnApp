-- ============================================================================
-- Unit 4: Onboarding, maker-checker, gating i śledzenie opłat (R4, R5, R14a, R14b)
--
-- Walidacja kompletności zgłoszenia żyje w silniku (src/engine/onboarding.ts);
-- tu jest trwałość + atomowa akceptacja (maker-checker) jako RPC. Gating jazd
-- opiera się na enrollment.cleared_to_drive (dodane w 0003, ustawiane tu ręcznie).
-- ============================================================================

create type application_status as enum ('pending', 'approved', 'rejected');
create type payment_status as enum ('nieoplacony', 'czesciowo', 'oplacony');
create type consent_type as enum ('rodo', 'opiekun');

-- R14a: opłata za kurs jako status per kursant (płatność offline, raty).
alter table enrollment
  add column payment_status payment_status not null default 'nieoplacony',
  add column cena numeric(10, 2),
  add column wplacono numeric(10, 2) not null default 0 check (wplacono >= 0);

-- ----------------------------------------------------------------------------
-- candidate_application — zgłoszenie z publicznego linku zapisów (R4).
-- ----------------------------------------------------------------------------
create table candidate_application (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  course_id uuid not null,
  status application_status not null default 'pending',
  imie text not null,
  nazwisko text not null,
  email text not null,
  telefon text not null,
  kategoria text not null default 'B',
  pkk_number text not null,
  data_urodzenia date not null,
  -- Zadeklarowane okna dostępności: [{ "start_ts": ..., "end_ts": ... }, ...]
  dostepnosc jsonb not null default '[]'::jsonb,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  enrollment_id uuid references enrollment (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (course_id, osk_id) references course (id, osk_id) on delete cascade
);

create index candidate_application_osk_id_idx on candidate_application (osk_id);
create index candidate_application_status_idx on candidate_application (osk_id, status);

-- ----------------------------------------------------------------------------
-- consent — ślad zgód RODO / opiekuna dla zgłoszenia (R4).
-- ----------------------------------------------------------------------------
create table consent (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  application_id uuid not null references candidate_application (id) on delete cascade,
  typ consent_type not null,
  tresc text,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (application_id, typ)
);

create index consent_application_id_idx on consent (application_id);

-- ----------------------------------------------------------------------------
-- Maker-checker: atomowa akceptacja zgłoszenia (R5).
-- Tworzy membership kursanta (jeśli brak), enrollment i kopiuje dostępność;
-- oznacza zgłoszenie jako approved. Transakcyjnie — częściowy zapis niemożliwy.
-- ----------------------------------------------------------------------------
create or replace function public.approve_application(_application_id uuid, _user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  app candidate_application;
  _membership_id uuid;
  _enrollment_id uuid;
  okno jsonb;
begin
  select * into app from candidate_application where id = _application_id for update;
  if app.id is null then
    raise exception 'Zgłoszenie nie istnieje';
  end if;
  if app.status <> 'pending' then
    raise exception 'Zgłoszenie nie jest w stanie pending (jest %)', app.status;
  end if;
  if not public.is_admin_of(app.osk_id) then
    raise exception 'Akceptacja wymaga roli admin w OSK';
  end if;

  -- Membership kursanta (idempotentnie).
  select id into _membership_id from membership
  where osk_id = app.osk_id and user_id = _user_id;
  if _membership_id is null then
    insert into membership (osk_id, user_id, rola)
    values (app.osk_id, _user_id, 'kursant')
    returning id into _membership_id;
  end if;

  -- Enrollment (cleared_to_drive = false: teoria/nauka tak, jazdy dopiero po fladze).
  insert into enrollment (osk_id, course_id, membership_id)
  values (app.osk_id, app.course_id, _membership_id)
  returning id into _enrollment_id;

  -- Skopiuj zadeklarowane okna dostępności do availability.
  for okno in select * from jsonb_array_elements(app.dostepnosc) loop
    if (okno ? 'start_ts') and (okno ? 'end_ts') then
      insert into availability (osk_id, enrollment_id, start_ts, end_ts)
      values (app.osk_id, _enrollment_id,
              (okno ->> 'start_ts')::timestamptz, (okno ->> 'end_ts')::timestamptz);
    end if;
  end loop;

  update candidate_application
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        enrollment_id = _enrollment_id
  where id = _application_id;

  return _enrollment_id;
end;
$$;

create or replace function public.reject_application(_application_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare _osk uuid;
begin
  select osk_id into _osk from candidate_application where id = _application_id;
  if _osk is null then raise exception 'Zgłoszenie nie istnieje'; end if;
  if not public.is_admin_of(_osk) then
    raise exception 'Odrzucenie wymaga roli admin w OSK';
  end if;
  update candidate_application
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = _application_id and status = 'pending';
end;
$$;

revoke execute on function public.approve_application(uuid, uuid) from public, anon;
revoke execute on function public.reject_application(uuid) from public, anon;
grant execute on function public.approve_application(uuid, uuid) to authenticated, service_role;
grant execute on function public.reject_application(uuid) to authenticated, service_role;

-- ============================================================================
-- RLS: zgłoszenia i zgody widoczne/zarządzane tylko przez admina OSK.
-- Wstawianie zgłoszeń idzie przez Edge Function submit-application (service_role).
-- ============================================================================
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter table candidate_application enable row level security;
alter table consent enable row level security;

create policy candidate_application_admin_all on candidate_application
  for all to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy consent_admin_all on consent
  for all to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));
