-- ============================================================================
-- Unit 1: Fundament multi-tenant — tabele rdzeniowe (R1, R2, R3)
--
-- Multi-tenancy: jeden projekt Supabase, wspólna schema, kolumna `osk_id`
-- na tabelach tenant-scoped, izolacja przez RLS (polityki w 0002).
-- Spójność tenanta wymuszana złożonymi kluczami obcymi (id, osk_id) —
-- rekord nie może wskazywać na rodzica z innego OSK.
-- ============================================================================

create extension if not exists pgcrypto;

-- Rola użytkownika w ramach OSK (user <-> osk <-> rola).
create type membership_role as enum (
  'kandydat',
  'kursant',
  'instruktor',
  'wykladowca',
  'instruktor_2w1',
  'admin'
);

-- Typ roli instruktora przy zatrudnieniu (R3).
create type instructor_type as enum (
  'wykladowca',
  'instruktor_praktyki',
  'instruktor_2w1'
);

create type enrollment_status as enum (
  'aktywny',
  'zakonczony',
  'przerwany'
);

-- ----------------------------------------------------------------------------
-- osk — konto ośrodka (tenant). R1.
-- ----------------------------------------------------------------------------
create table osk (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null check (length(trim(nazwa)) > 0),
  -- Okno odwołania jazdy bez konsekwencji, konfigurowalne per OSK (domyślnie 24 h).
  okno_odwolania_h integer not null default 24 check (okno_odwolania_h > 0),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- membership — przypisanie użytkownika do OSK z rolą.
-- ----------------------------------------------------------------------------
create table membership (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rola membership_role not null,
  created_at timestamptz not null default now(),
  unique (osk_id, user_id),
  unique (id, osk_id)
);

create index membership_user_id_idx on membership (user_id);
create index membership_osk_id_idx on membership (osk_id);

-- ----------------------------------------------------------------------------
-- course — kurs z profilem godzinowym (R2).
-- ----------------------------------------------------------------------------
create table course (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  nazwa text not null check (length(trim(nazwa)) > 0),
  kategoria text not null default 'B',
  h_teoria integer not null check (h_teoria >= 0),
  h_praktyka integer not null check (h_praktyka >= 0),
  zapisy_otwarte boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, osk_id)
);

create index course_osk_id_idx on course (osk_id);

-- ----------------------------------------------------------------------------
-- instructor — instruktor zatrudniony w OSK, z typem roli (R3).
-- Powiązany z membership (instruktor jest użytkownikiem systemu).
-- ----------------------------------------------------------------------------
create table instructor (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  membership_id uuid not null unique,
  typ instructor_type not null,
  aktywny boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, osk_id),
  foreign key (membership_id, osk_id) references membership (id, osk_id) on delete cascade
);

create index instructor_osk_id_idx on instructor (osk_id);

-- ----------------------------------------------------------------------------
-- course_instructor — przypisanie instruktora do kursu (R3).
-- ----------------------------------------------------------------------------
create table course_instructor (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  course_id uuid not null,
  instructor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (course_id, instructor_id),
  foreign key (course_id, osk_id) references course (id, osk_id) on delete cascade,
  foreign key (instructor_id, osk_id) references instructor (id, osk_id) on delete cascade
);

create index course_instructor_osk_id_idx on course_instructor (osk_id);

-- ----------------------------------------------------------------------------
-- working_hours — cotygodniowe okna pracy instruktora (R3).
-- Dostępność instruktora = working_hours minus zajęte sloty (Unit 3).
-- ----------------------------------------------------------------------------
create table working_hours (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  instructor_id uuid not null,
  -- 0 = poniedziałek ... 6 = niedziela
  dzien_tygodnia integer not null check (dzien_tygodnia between 0 and 6),
  od_godz time not null,
  do_godz time not null,
  check (od_godz < do_godz),
  foreign key (instructor_id, osk_id) references instructor (id, osk_id) on delete cascade
);

create index working_hours_osk_id_idx on working_hours (osk_id);
create index working_hours_instructor_id_idx on working_hours (instructor_id);

-- ----------------------------------------------------------------------------
-- enrollment — zapis kursanta (membership) na kurs.
-- Tworzony przy zatwierdzeniu zgłoszenia (maker-checker, Unit 4).
-- ----------------------------------------------------------------------------
create table enrollment (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  course_id uuid not null,
  membership_id uuid not null,
  status enrollment_status not null default 'aktywny',
  created_at timestamptz not null default now(),
  unique (course_id, membership_id),
  unique (id, osk_id),
  foreign key (course_id, osk_id) references course (id, osk_id) on delete cascade,
  foreign key (membership_id, osk_id) references membership (id, osk_id) on delete cascade
);

create index enrollment_osk_id_idx on enrollment (osk_id);
create index enrollment_membership_id_idx on enrollment (membership_id);
