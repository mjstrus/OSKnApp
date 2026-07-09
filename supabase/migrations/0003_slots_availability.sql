-- ============================================================================
-- Unit 3: Terminarz — sloty praktyki, dostępność, teoria, obecność (R6–R10)
--
-- Silnik (src/engine/scheduling.ts) liczy wolne okna i waliduje rezerwacje;
-- tu DB pełni rolę GUARDRAILA: constrainty EXCLUDE gwarantują brak
-- double-bookingu pod współbieżnością (1 instruktor : 1 kursant w danym czasie),
-- niezależnie od logiki aplikacyjnej.
--
-- UWAGA (odchylenie od planu): `enrollment.cleared_to_drive` (R14b) dodajemy tu,
-- bo to Unit 3 (book-slot) egzekwuje gating jazd. Unit 4 (0004) będzie tę flagę
-- tylko USTAWIAĆ (przepływ admina) i doda payment_status/candidate_application.
-- ============================================================================

create extension if not exists btree_gist;

-- Stany slotu wg diagramu automatu (plan). Aktywne = 'zaplanowany','odbyty'.
create type slot_status as enum (
  'zaplanowany',
  'odbyty',
  'odwolany_w_oknie',
  'usprawiedliwiony',
  'nieusprawiedliwiony'
);

-- Forward-compat EKK: ślad synchronizacji zdarzenia obecności.
create type sync_status as enum (
  'lokalny',
  'zsynchronizowany'
);

-- R14b: miękka flaga „dopuszczony do jazd" (ustawiana ręcznie przez admina w Unit 4).
alter table enrollment
  add column cleared_to_drive boolean not null default false;

-- ----------------------------------------------------------------------------
-- availability — zadeklarowane okna dostępności kursanta (R7).
-- ----------------------------------------------------------------------------
create table availability (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  enrollment_id uuid not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  created_at timestamptz not null default now(),
  check (start_ts < end_ts),
  foreign key (enrollment_id, osk_id) references enrollment (id, osk_id) on delete cascade
);

create index availability_osk_id_idx on availability (osk_id);
create index availability_enrollment_id_idx on availability (enrollment_id);

-- ----------------------------------------------------------------------------
-- theory_session — auto-rozpisane bloki teorii grupowej per kurs (R6).
-- ----------------------------------------------------------------------------
create table theory_session (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  course_id uuid not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  liczba_godzin integer not null check (liczba_godzin > 0),
  created_at timestamptz not null default now(),
  check (start_ts < end_ts),
  foreign key (course_id, osk_id) references course (id, osk_id) on delete cascade
);

create index theory_session_osk_id_idx on theory_session (osk_id);
create index theory_session_course_id_idx on theory_session (course_id);

-- ----------------------------------------------------------------------------
-- slot — rezerwacja jazdy praktycznej (R7, R9, R10).
-- EXCLUDE: żaden aktywny slot instruktora ani kursanta nie może się nakładać
-- w czasie — to twarda gwarancja przeciw double-bookingowi (R10, współbieżność).
-- Odwołane/nieodbyte sloty wypadają z ograniczenia (WHERE), więc czas można
-- ponownie zarezerwować.
-- ----------------------------------------------------------------------------
create table slot (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  enrollment_id uuid not null,
  instructor_id uuid not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  status slot_status not null default 'zaplanowany',
  created_at timestamptz not null default now(),
  check (start_ts < end_ts),
  foreign key (enrollment_id, osk_id) references enrollment (id, osk_id) on delete cascade,
  foreign key (instructor_id, osk_id) references instructor (id, osk_id) on delete cascade,
  constraint slot_instructor_no_overlap exclude using gist (
    instructor_id with =,
    tstzrange (start_ts, end_ts) with &&
  ) where (status in ('zaplanowany', 'odbyty')),
  constraint slot_enrollment_no_overlap exclude using gist (
    enrollment_id with =,
    tstzrange (start_ts, end_ts) with &&
  ) where (status in ('zaplanowany', 'odbyty'))
);

create index slot_osk_id_idx on slot (osk_id);
create index slot_enrollment_id_idx on slot (enrollment_id);
create index slot_instructor_id_idx on slot (instructor_id);

-- ----------------------------------------------------------------------------
-- attendance_event — obecność jako ROZSZERZALNE ZDARZENIE (forward-compat EKK).
-- W MVP wypełnia instruktor retrospektywnie; struktura gotowa na v2 (real-time,
-- dwustronny podpis, ślad GPS, kolejka offline → sync_status).
-- ----------------------------------------------------------------------------
create table attendance_event (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  slot_id uuid not null unique,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  -- Dwa miejsca na podpis (v2 EKK: dwustronne potwierdzenie).
  podpis_instruktor_ts timestamptz,
  podpis_kursant_ts timestamptz,
  gps_slad jsonb,
  sync_status sync_status not null default 'zsynchronizowany',
  created_at timestamptz not null default now(),
  check (start_ts < end_ts),
  foreign key (slot_id) references slot (id) on delete cascade
);

create index attendance_event_osk_id_idx on attendance_event (osk_id);

-- ============================================================================
-- RLS
-- ============================================================================

-- Helpery SECURITY DEFINER (omijają RLS, by uniknąć rekursji polityk).
create or replace function public.owns_enrollment(_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollment e
    join membership m on m.id = e.membership_id
    where e.id = _enrollment_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.teaches_as_instructor(_instructor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from instructor i
    join membership m on m.id = i.membership_id
    where i.id = _instructor_id and m.user_id = auth.uid()
  );
$$;

-- Czy bieżący użytkownik widzi dany slot (kursant-właściciel, instruktor lub admin).
create or replace function public.can_see_slot(_slot_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from slot s
    where s.id = _slot_id
      and (
        public.is_admin_of(s.osk_id)
        or public.owns_enrollment(s.enrollment_id)
        or public.teaches_as_instructor(s.instructor_id)
      )
  );
$$;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter table availability enable row level security;
alter table theory_session enable row level security;
alter table slot enable row level security;
alter table attendance_event enable row level security;

-- availability: kursant zarządza własną; admin widzi/zarządza w OSK.
create policy availability_select on availability
  for select to authenticated
  using (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id));
create policy availability_insert on availability
  for insert to authenticated
  with check (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id));
create policy availability_update on availability
  for update to authenticated
  using (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id))
  with check (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id));
create policy availability_delete on availability
  for delete to authenticated
  using (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id));

-- theory_session: każdy członek OSK czyta (kursanci widzą plan wykładów);
-- zapis tylko admin (generate-theory działa jako service_role).
create policy theory_session_select_member on theory_session
  for select to authenticated
  using (public.is_member_of(osk_id));
create policy theory_session_write_admin on theory_session
  for all to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

-- slot: widzi kursant-właściciel, instruktor prowadzący i admin.
-- Zapisy przechodzą przez Edge Functions (service_role) + potwierdzanie obecności
-- przez instruktora; bezpośrednio z RLS pisze admin, a instruktor aktualizuje
-- swoje sloty (potwierdzenie obecności zamyka slot — R9).
create policy slot_select on slot
  for select to authenticated
  using (
    public.is_admin_of(osk_id)
    or public.owns_enrollment(enrollment_id)
    or public.teaches_as_instructor(instructor_id)
  );
create policy slot_insert_admin on slot
  for insert to authenticated
  with check (public.is_admin_of(osk_id));
create policy slot_update_admin_or_instructor on slot
  for update to authenticated
  using (public.is_admin_of(osk_id) or public.teaches_as_instructor(instructor_id))
  with check (public.is_admin_of(osk_id) or public.teaches_as_instructor(instructor_id));
create policy slot_delete_admin on slot
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- attendance_event: widoczność jak slot; zapis admin/instruktor prowadzący.
create policy attendance_event_select on attendance_event
  for select to authenticated
  using (public.can_see_slot(slot_id));
create policy attendance_event_insert on attendance_event
  for insert to authenticated
  with check (
    public.is_admin_of(osk_id)
    or exists (select 1 from slot s where s.id = slot_id and public.teaches_as_instructor(s.instructor_id))
  );
create policy attendance_event_update on attendance_event
  for update to authenticated
  using (
    public.is_admin_of(osk_id)
    or exists (select 1 from slot s where s.id = slot_id and public.teaches_as_instructor(s.instructor_id))
  )
  with check (
    public.is_admin_of(osk_id)
    or exists (select 1 from slot s where s.id = slot_id and public.teaches_as_instructor(s.instructor_id))
  );
