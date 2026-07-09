-- ============================================================================
-- Unit 1: Testy izolacji RLS (scenariusze z planu)
--
--  1. Użytkownik OSK A nie widzi żadnych rekordów OSK B.
--  2. Kursant nie może odczytać cudzego enrollment.
--  3. Admin OSK A widzi wszystkie kursy A, żadnego z B.
--  + zakresy ról (kursant nie pisze do konfiguracji), anon, service_role,
--    bootstrap create_osk.
--
-- Uruchamianie: psql -v ON_ERROR_STOP=1 -f rls_isolation.test.sql
-- jako superuser/postgres (seed omija RLS przez ownership); scenariusze
-- przełączają się na role anon/authenticated przez SET LOCAL ROLE + claims JWT.
-- Każdy DO-blok to osobna transakcja — ustawienia nie wyciekają między testami.
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- Czyszczenie i seed (jako właściciel tabel — RLS nie filtruje)
-- ----------------------------------------------------------------------------
begin;

truncate table osk cascade;
delete from auth.users where email like '%@rls-test.local';

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'admin-a@rls-test.local'),
  ('11111111-0000-0000-0000-000000000002', 'kursant-a1@rls-test.local'),
  ('11111111-0000-0000-0000-000000000003', 'kursant-a2@rls-test.local'),
  ('11111111-0000-0000-0000-000000000004', 'instruktor-a@rls-test.local'),
  ('22222222-0000-0000-0000-000000000001', 'admin-b@rls-test.local'),
  ('22222222-0000-0000-0000-000000000002', 'kursant-b1@rls-test.local'),
  ('22222222-0000-0000-0000-000000000003', 'instruktor-b@rls-test.local'),
  ('33333333-0000-0000-0000-000000000001', 'outsider-c@rls-test.local');

insert into osk (id, nazwa) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'OSK A'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'OSK B');

insert into membership (id, osk_id, user_id, rola) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'admin'),
  ('aaaaaaaa-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'kursant'),
  ('aaaaaaaa-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'kursant'),
  ('aaaaaaaa-1111-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'instruktor'),
  ('bbbbbbbb-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'kursant'),
  ('bbbbbbbb-1111-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 'instruktor');

insert into course (id, osk_id, nazwa, h_teoria, h_praktyka) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kurs kat. B — poranny', 30, 30),
  ('aaaaaaaa-2222-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kurs kat. B — wieczorny', 30, 30),
  ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Kurs kat. B', 30, 30);

insert into instructor (id, osk_id, membership_id, typ) values
  ('aaaaaaaa-3333-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000004', 'instruktor_praktyki'),
  ('bbbbbbbb-3333-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-1111-0000-0000-000000000003', 'instruktor_2w1');

insert into course_instructor (osk_id, course_id, instructor_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-3333-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-3333-0000-0000-000000000001');

insert into working_hours (osk_id, instructor_id, dzien_tygodnia, od_godz, do_godz) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-3333-0000-0000-000000000001', 0, '08:00', '16:00'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-3333-0000-0000-000000000001', 2, '10:00', '18:00'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-3333-0000-0000-000000000001', 4, '08:00', '14:00');

insert into enrollment (id, osk_id, course_id, membership_id) values
  ('aaaaaaaa-4444-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000002'),
  ('aaaaaaaa-4444-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000003'),
  ('bbbbbbbb-4444-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-1111-0000-0000-000000000002');

commit;

-- ----------------------------------------------------------------------------
-- Test 1: Kursant A1 — widzi wyłącznie dane OSK A i tylko własny enrollment
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from osk;
  if cnt <> 1 then raise exception 'FAIL: kursant A1 powinien widzieć 1 OSK, widzi %', cnt; end if;

  select count(*) into cnt from osk where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if cnt <> 0 then raise exception 'FAIL: kursant A1 widzi OSK B'; end if;

  select count(*) into cnt from course;
  if cnt <> 2 then raise exception 'FAIL: kursant A1 powinien widzieć 2 kursy OSK A, widzi %', cnt; end if;

  select count(*) into cnt from course where osk_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if cnt <> 0 then raise exception 'FAIL: kursant A1 widzi kursy OSK B'; end if;

  select count(*) into cnt from instructor;
  if cnt <> 1 then raise exception 'FAIL: kursant A1 powinien widzieć 1 instruktora (OSK A), widzi %', cnt; end if;

  select count(*) into cnt from working_hours;
  if cnt <> 2 then raise exception 'FAIL: kursant A1 powinien widzieć 2 okna pracy (OSK A), widzi %', cnt; end if;

  select count(*) into cnt from course_instructor;
  if cnt <> 1 then raise exception 'FAIL: kursant A1 powinien widzieć 1 przypisanie (OSK A), widzi %', cnt; end if;

  -- membership: tylko własne (nie jest adminem)
  select count(*) into cnt from membership;
  if cnt <> 1 then raise exception 'FAIL: kursant A1 powinien widzieć tylko własny membership, widzi %', cnt; end if;

  -- enrollment: tylko własny
  select count(*) into cnt from enrollment;
  if cnt <> 1 then raise exception 'FAIL: kursant A1 powinien widzieć 1 enrollment (własny), widzi %', cnt; end if;

  select count(*) into cnt from enrollment where id = 'aaaaaaaa-4444-0000-0000-000000000001';
  if cnt <> 1 then raise exception 'FAIL: kursant A1 nie widzi własnego enrollment'; end if;

  raise notice 'PASS: kursant A1 — izolacja tenantów i zakres roli OK';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 2: Kursant A1 nie odczyta cudzego enrollment (kursanta A2, ten sam OSK)
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from enrollment where id = 'aaaaaaaa-4444-0000-0000-000000000002';
  if cnt <> 0 then raise exception 'FAIL: kursant A1 widzi enrollment kursanta A2'; end if;

  select count(*) into cnt from enrollment where membership_id = 'aaaaaaaa-1111-0000-0000-000000000003';
  if cnt <> 0 then raise exception 'FAIL: kursant A1 widzi enrollment po membership_id A2'; end if;

  raise notice 'PASS: cudzy enrollment niewidoczny dla kursanta';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 3: Admin OSK A — widzi wszystko w A, nic z B
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from course;
  if cnt <> 2 then raise exception 'FAIL: admin A powinien widzieć 2 kursy A, widzi %', cnt; end if;

  select count(*) into cnt from course where osk_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if cnt <> 0 then raise exception 'FAIL: admin A widzi kursy OSK B'; end if;

  select count(*) into cnt from membership;
  if cnt <> 4 then raise exception 'FAIL: admin A powinien widzieć 4 membershipy A, widzi %', cnt; end if;

  select count(*) into cnt from enrollment;
  if cnt <> 2 then raise exception 'FAIL: admin A powinien widzieć 2 enrollmenty A, widzi %', cnt; end if;

  select count(*) into cnt from osk;
  if cnt <> 1 then raise exception 'FAIL: admin A powinien widzieć tylko OSK A, widzi %', cnt; end if;

  raise notice 'PASS: admin A — pełny zakres w A, zero z B';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 4: Admin OSK B — symetrycznie: nic z A
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '22222222-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from course;
  if cnt <> 1 then raise exception 'FAIL: admin B powinien widzieć 1 kurs B, widzi %', cnt; end if;

  select count(*) into cnt from enrollment;
  if cnt <> 1 then raise exception 'FAIL: admin B powinien widzieć 1 enrollment B, widzi %', cnt; end if;

  select count(*) into cnt from membership where osk_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if cnt <> 0 then raise exception 'FAIL: admin B widzi membershipy OSK A'; end if;

  raise notice 'PASS: admin B — zero danych OSK A';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 5: Kursant nie zapisuje do konfiguracji OSK (kurs, membership, osk)
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
  denied boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into course (osk_id, nazwa, h_teoria, h_praktyka)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Nielegalny kurs', 1, 1);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: kursant wstawił kurs (RLS przepuścił INSERT)'; end if;

  denied := false;
  begin
    insert into membership (osk_id, user_id, rola)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'admin');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: kursant nadał komuś rolę (RLS przepuścił INSERT do membership)'; end if;

  -- UPDATE bez pasującej polityki USING: 0 wierszy dotkniętych
  update osk set nazwa = 'Przejęte OSK' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics cnt = row_count;
  if cnt <> 0 then raise exception 'FAIL: kursant zaktualizował rekord OSK'; end if;

  update course set h_praktyka = 0 where id = 'aaaaaaaa-2222-0000-0000-000000000001';
  get diagnostics cnt = row_count;
  if cnt <> 0 then raise exception 'FAIL: kursant zaktualizował kurs'; end if;

  raise notice 'PASS: kursant bez praw zapisu do konfiguracji OSK';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 6: Admin A pisze w swoim OSK, ale nie w OSK B
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
  denied boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into course (osk_id, nazwa, h_teoria, h_praktyka)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Kurs testowy admina', 30, 30);

  begin
    insert into course (osk_id, nazwa, h_teoria, h_praktyka)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'Wstrzyknięty kurs', 1, 1);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: admin A wstawił kurs do OSK B'; end if;

  update course set zapisy_otwarte = false where osk_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics cnt = row_count;
  if cnt <> 0 then raise exception 'FAIL: admin A zaktualizował kurs OSK B'; end if;

  raise notice 'PASS: admin A pisze tylko we własnym OSK';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 7: Użytkownik bez membership i anon — nic nie widzą
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '33333333-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select (select count(*) from osk)
       + (select count(*) from course)
       + (select count(*) from membership)
       + (select count(*) from enrollment)
       + (select count(*) from instructor)
       + (select count(*) from working_hours)
       + (select count(*) from course_instructor)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: użytkownik bez membership widzi % wierszy', cnt; end if;

  raise notice 'PASS: użytkownik bez membership nie widzi niczego';
end
$$;

do $$
declare
  cnt bigint;
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  select (select count(*) from osk) + (select count(*) from course) + (select count(*) from enrollment)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: anon widzi % wierszy', cnt; end if;

  raise notice 'PASS: anon nie widzi niczego';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 8: service_role omija RLS (parytet z Supabase — Edge Functions)
-- ----------------------------------------------------------------------------
do $$
declare
  cnt bigint;
begin
  set local role service_role;

  select count(*) into cnt from osk;
  if cnt < 2 then raise exception 'FAIL: service_role powinien widzieć oba OSK, widzi %', cnt; end if;

  raise notice 'PASS: service_role omija RLS';
end
$$;

-- ----------------------------------------------------------------------------
-- Test 9: Bootstrap — nowy użytkownik zakłada OSK przez create_osk (R1)
-- ----------------------------------------------------------------------------
do $$
declare
  new_osk uuid;
  cnt bigint;
  rola_txt text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '33333333-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  new_osk := public.create_osk('OSK C — bootstrap');

  select count(*) into cnt from osk where id = new_osk;
  if cnt <> 1 then raise exception 'FAIL: założyciel nie widzi swojego OSK po create_osk'; end if;

  select m.rola::text into rola_txt from membership m where m.osk_id = new_osk;
  if rola_txt is distinct from 'admin' then
    raise exception 'FAIL: założyciel OSK nie dostał roli admin (rola: %)', rola_txt;
  end if;

  -- świeży admin może już konfigurować swój OSK
  insert into course (osk_id, nazwa, h_teoria, h_praktyka) values (new_osk, 'Pierwszy kurs', 30, 30);

  raise notice 'PASS: bootstrap create_osk + natychmiastowe uprawnienia admina';
end
$$;

select 'ALL RLS ISOLATION TESTS PASSED' as result;
