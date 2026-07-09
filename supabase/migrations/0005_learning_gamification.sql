-- ============================================================================
-- Unit 5: Strefa nauki + grywalizacja (R16, R17, R18)
--
-- Logika doboru/punktacji (src/engine/exam.ts) i rankingu (leaderboard.ts) żyje
-- w silniku; tu jest trwałość: bank pytań (globalny, elastyczny model), podejścia,
-- odpowiedzi i PRYWATNY scoring instruktora (widoczny wyłącznie dla admina).
-- ============================================================================

create type question_type as enum ('podstawowe', 'specjalistyczne');
create type attempt_mode as enum ('nauka', 'symulacja');

-- ----------------------------------------------------------------------------
-- question — globalny bank pytań (oficjalna baza). Model elastyczny: nie zaszywamy
-- liczby ani sztywnej struktury (baza w reformie). Media opcjonalne.
-- ----------------------------------------------------------------------------
create table question (
  id uuid primary key default gen_random_uuid(),
  kategoria text not null default 'B',
  typ question_type not null,
  waga smallint not null check (waga between 1 and 3),
  tresc text not null,
  media_url text,
  -- Opcje dla pytań specjalistycznych (np. {"A": "...", "B": "...", "C": "..."}).
  opcje jsonb,
  -- Poprawna odpowiedź jako tekst: podstawowe "TAK"/"NIE", specjalistyczne "A"/"B"/"C".
  poprawna text not null,
  aktywne boolean not null default true,
  created_at timestamptz not null default now()
);

create index question_dobor_idx on question (kategoria, typ, aktywne);

-- ----------------------------------------------------------------------------
-- test_attempt — podejście kursanta (tryb nauki lub symulacji).
-- ----------------------------------------------------------------------------
create table test_attempt (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  enrollment_id uuid not null,
  tryb attempt_mode not null,
  punkty integer,
  max_pkt integer,
  zaliczony boolean,
  rozpoczeto_ts timestamptz not null default now(),
  zakonczono_ts timestamptz,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, osk_id) references enrollment (id, osk_id) on delete cascade
);

create index test_attempt_enrollment_idx on test_attempt (enrollment_id);
create index test_attempt_osk_idx on test_attempt (osk_id);

-- ----------------------------------------------------------------------------
-- answer — pojedyncza odpowiedź w podejściu (prywatna dla kursanta/admina).
-- ----------------------------------------------------------------------------
create table answer (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  attempt_id uuid not null references test_attempt (id) on delete cascade,
  question_id uuid not null references question (id) on delete restrict,
  wybrana_odp text,
  poprawna boolean not null,
  created_at timestamptz not null default now()
);

create index answer_attempt_idx on answer (attempt_id);

-- ----------------------------------------------------------------------------
-- instructor_feedback — feedback po jeździe → PRYWATNY scoring instruktora (R18).
-- Widoczny wyłącznie dla admina; instruktor może dodać, ale nie odczytać.
-- ----------------------------------------------------------------------------
create table instructor_feedback (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  instructor_id uuid not null,
  enrollment_id uuid,
  slot_id uuid references slot (id) on delete set null,
  ocena smallint not null check (ocena between 1 and 5),
  komentarz text,
  created_at timestamptz not null default now(),
  foreign key (instructor_id, osk_id) references instructor (id, osk_id) on delete cascade,
  foreign key (enrollment_id, osk_id) references enrollment (id, osk_id) on delete set null
);

create index instructor_feedback_instructor_idx on instructor_feedback (instructor_id);
create index instructor_feedback_osk_idx on instructor_feedback (osk_id);

-- ============================================================================
-- Helpery + RLS
-- ============================================================================

-- Czy bieżący użytkownik jest kursantem tego samego kursu co _enrollment_id
-- (podstawa widoczności leaderboardu — R17).
create or replace function public.shares_course(_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from enrollment moj
    join membership m on m.id = moj.membership_id
    where m.user_id = auth.uid()
      and moj.course_id = (select course_id from enrollment where id = _enrollment_id)
  );
$$;

-- Czy bieżący użytkownik ma dostęp do danego podejścia (właściciel lub admin).
create or replace function public.can_access_attempt(_attempt_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from test_attempt a
    where a.id = _attempt_id
      and (public.owns_enrollment(a.enrollment_id) or public.is_admin_of(a.osk_id))
  );
$$;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter table question enable row level security;
alter table test_attempt enable row level security;
alter table answer enable row level security;
alter table instructor_feedback enable row level security;

-- question: globalny bank do nauki — czyta każdy zalogowany; zapis tylko seed
-- (service_role omija RLS, brak polityk zapisu dla zwykłych ról).
create policy question_select_authenticated on question
  for select to authenticated
  using (true);

-- test_attempt: właściciel i admin zawsze; podejścia SYMULACJI widoczne dla
-- kursantów tego samego kursu (leaderboard). Tryb nauki pozostaje prywatny.
create policy test_attempt_select on test_attempt
  for select to authenticated
  using (
    public.owns_enrollment(enrollment_id)
    or public.is_admin_of(osk_id)
    or (tryb = 'symulacja' and public.shares_course(enrollment_id))
  );
create policy test_attempt_insert on test_attempt
  for insert to authenticated
  with check (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id));
create policy test_attempt_update on test_attempt
  for update to authenticated
  using (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id))
  with check (public.owns_enrollment(enrollment_id) or public.is_admin_of(osk_id));
create policy test_attempt_delete_admin on test_attempt
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- answer: prywatna — tylko właściciel podejścia i admin (nawet koledzy z kursu nie).
create policy answer_select on answer
  for select to authenticated
  using (public.can_access_attempt(attempt_id));
create policy answer_insert on answer
  for insert to authenticated
  with check (public.can_access_attempt(attempt_id));

-- instructor_feedback: PRYWATNY scoring — SELECT wyłącznie admin (R18).
-- Dodać może admin lub instruktor prowadzący; odczytać tylko admin.
create policy instructor_feedback_select_admin on instructor_feedback
  for select to authenticated
  using (public.is_admin_of(osk_id));
create policy instructor_feedback_insert on instructor_feedback
  for insert to authenticated
  with check (public.is_admin_of(osk_id) or public.teaches_as_instructor(instructor_id));
create policy instructor_feedback_update_admin on instructor_feedback
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));
create policy instructor_feedback_delete_admin on instructor_feedback
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- ----------------------------------------------------------------------------
-- Seed: mały, oryginalny zestaw pytań (placeholder do czasu procurementu bazy).
-- Symulacja 32-pytaniowa wymaga pełnej bazy — seed obsługuje tryb nauki/demo.
-- ----------------------------------------------------------------------------
insert into question (kategoria, typ, waga, tresc, poprawna) values
  ('B', 'podstawowe', 3, 'Czy przed rozpoczęciem jazdy kierowca ma obowiązek zapiąć pasy bezpieczeństwa?', 'TAK'),
  ('B', 'podstawowe', 3, 'Czy wolno wyprzedzać na przejściu dla pieszych?', 'NIE'),
  ('B', 'podstawowe', 2, 'Czy w tunelu obowiązuje zakaz zawracania?', 'TAK'),
  ('B', 'podstawowe', 1, 'Czy sygnał czerwony oznacza zakaz wjazdu za sygnalizator?', 'TAK'),
  ('B', 'specjalistyczne', 3, 'Jaki jest dopuszczalny nacisk uwagi kierowcy w sytuacji zbliżania się do skrzyżowania?', 'A'),
  ('B', 'specjalistyczne', 2, 'Które zachowanie jest prawidłowe podczas włączania się do ruchu?', 'B');
