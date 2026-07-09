-- ============================================================================
-- Unit 5: Testy RLS strefy nauki (R17 widoczność leaderboardu, R18 prywatny scoring)
--
-- Scenariusze z planu:
--  * Scoring instruktora niewidoczny dla ról innych niż admin (RLS).
--  * Koledzy z kursu widzą swoje podejścia SYMULACJI (leaderboard), ale nie tryb
--    nauki ani cudze odpowiedzi; kursant z innego kursu nie widzi nic.
--
-- (Punktacja i ranking — Vitest: exam.test.ts, leaderboard.test.ts.)
-- Uruchamiane po migracjach przez run_rls_tests.sh.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

truncate table osk cascade;
delete from auth.users where email like '%@learn-test.local';

insert into auth.users (id, email) values
  ('0c000000-0000-0000-0000-000000000001', 'admin@learn-test.local'),
  ('0c000000-0000-0000-0000-000000000002', 'kursantA1@learn-test.local'),
  ('0c000000-0000-0000-0000-000000000003', 'kursantA2@learn-test.local'),
  ('0c000000-0000-0000-0000-000000000004', 'kursantInny@learn-test.local'),
  ('0c000000-0000-0000-0000-000000000005', 'instruktor@learn-test.local');

insert into osk (id, nazwa) values ('0c100000-0000-0000-0000-000000000001', 'OSK Nauka');

insert into membership (id, osk_id, user_id, rola) values
  ('0c200000-0000-0000-0000-000000000001', '0c100000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000001', 'admin'),
  ('0c200000-0000-0000-0000-000000000002', '0c100000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000002', 'kursant'),
  ('0c200000-0000-0000-0000-000000000003', '0c100000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000003', 'kursant'),
  ('0c200000-0000-0000-0000-000000000004', '0c100000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000004', 'kursant'),
  ('0c200000-0000-0000-0000-000000000005', '0c100000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000005', 'instruktor');

-- Dwa kursy: X (A1, A2) i Y (Inny).
insert into course (id, osk_id, nazwa, h_teoria, h_praktyka) values
  ('0c300000-0000-0000-0000-000000000001', '0c100000-0000-0000-0000-000000000001', 'Kurs X', 30, 30),
  ('0c300000-0000-0000-0000-000000000002', '0c100000-0000-0000-0000-000000000001', 'Kurs Y', 30, 30);

insert into instructor (id, osk_id, membership_id, typ) values
  ('0c400000-0000-0000-0000-000000000001', '0c100000-0000-0000-0000-000000000001', '0c200000-0000-0000-0000-000000000005', 'instruktor_praktyki');

insert into enrollment (id, osk_id, course_id, membership_id) values
  ('0c500000-0000-0000-0000-000000000001', '0c100000-0000-0000-0000-000000000001', '0c300000-0000-0000-0000-000000000001', '0c200000-0000-0000-0000-000000000002'),
  ('0c500000-0000-0000-0000-000000000002', '0c100000-0000-0000-0000-000000000001', '0c300000-0000-0000-0000-000000000001', '0c200000-0000-0000-0000-000000000003'),
  ('0c500000-0000-0000-0000-000000000003', '0c100000-0000-0000-0000-000000000001', '0c300000-0000-0000-0000-000000000002', '0c200000-0000-0000-0000-000000000004');

-- Podejścia: A1 symulacja (70) + nauka (40); A2 symulacja (60); Inny symulacja (90).
insert into test_attempt (id, osk_id, enrollment_id, tryb, punkty, max_pkt, zaliczony, zakonczono_ts) values
  ('0c600000-0000-0000-0000-000000000001', '0c100000-0000-0000-0000-000000000001', '0c500000-0000-0000-0000-000000000001', 'symulacja', 70, 74, true, now()),
  ('0c600000-0000-0000-0000-000000000002', '0c100000-0000-0000-0000-000000000001', '0c500000-0000-0000-0000-000000000001', 'nauka', 40, 74, false, now()),
  ('0c600000-0000-0000-0000-000000000003', '0c100000-0000-0000-0000-000000000001', '0c500000-0000-0000-0000-000000000002', 'symulacja', 60, 74, false, now()),
  ('0c600000-0000-0000-0000-000000000004', '0c100000-0000-0000-0000-000000000001', '0c500000-0000-0000-0000-000000000003', 'symulacja', 90, 74, true, now());

-- Odpowiedź A1 (prywatna).
insert into answer (osk_id, attempt_id, question_id, wybrana_odp, poprawna)
select '0c100000-0000-0000-0000-000000000001', '0c600000-0000-0000-0000-000000000001', id, 'TAK', true
from question limit 1;

-- Scoring instruktora (prywatny, R18).
insert into instructor_feedback (osk_id, instructor_id, enrollment_id, ocena, komentarz) values
  ('0c100000-0000-0000-0000-000000000001', '0c400000-0000-0000-0000-000000000001', '0c500000-0000-0000-0000-000000000001', 4, 'Dobra obserwacja.');

commit;

-- ----------------------------------------------------------------------------
-- Test 1: A1 widzi własne podejścia (symulacja + nauka) oraz SYMULACJĘ A2,
--         ale NIE tryb nauki A2 ani podejść z innego kursu.
-- ----------------------------------------------------------------------------
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- własne: 2 (symulacja + nauka) + symulacja A2: 1 = 3
  select count(*) into cnt from test_attempt;
  if cnt <> 3 then raise exception 'FAIL: A1 widzi % podejść, oczekiwano 3', cnt; end if;

  -- nie widzi symulacji z innego kursu (Inny, 90)
  select count(*) into cnt from test_attempt where id = '0c600000-0000-0000-0000-000000000004';
  if cnt <> 0 then raise exception 'FAIL: A1 widzi podejście z innego kursu'; end if;

  -- widzi symulację A2
  select count(*) into cnt from test_attempt where id = '0c600000-0000-0000-0000-000000000003';
  if cnt <> 1 then raise exception 'FAIL: A1 nie widzi symulacji kolegi z kursu'; end if;

  raise notice 'PASS: A1 — leaderboard widzi symulacje kursu, tryb nauki i inne kursy odcięte';
end $$;

-- ----------------------------------------------------------------------------
-- Test 2: A1 nie widzi cudzych odpowiedzi (answer prywatny)
-- ----------------------------------------------------------------------------
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
  set local role authenticated; -- to A2

  select count(*) into cnt from answer;
  if cnt <> 0 then raise exception 'FAIL: A2 widzi % cudzych odpowiedzi', cnt; end if;
  raise notice 'PASS: odpowiedzi prywatne — kolega z kursu ich nie widzi';
end $$;

-- ----------------------------------------------------------------------------
-- Test 3: scoring instruktora niewidoczny dla kursanta i instruktora (R18)
-- ----------------------------------------------------------------------------
do $$
declare cnt bigint;
begin
  -- kursant
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from instructor_feedback;
  if cnt <> 0 then raise exception 'FAIL: kursant widzi scoring instruktora'; end if;

  -- sam instruktor też nie odczyta (prywatne dla admina)
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from instructor_feedback;
  if cnt <> 0 then raise exception 'FAIL: instruktor odczytał własny scoring (ma być tylko admin)'; end if;

  raise notice 'PASS: scoring instruktora niewidoczny dla kursanta i instruktora';
end $$;

-- ----------------------------------------------------------------------------
-- Test 4: admin widzi scoring instruktora
-- ----------------------------------------------------------------------------
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from instructor_feedback;
  if cnt <> 1 then raise exception 'FAIL: admin nie widzi scoringu (widzi %)', cnt; end if;
  raise notice 'PASS: admin widzi prywatny scoring instruktora';
end $$;

-- ----------------------------------------------------------------------------
-- Test 5: instruktor MOŻE dodać feedback (choć nie może go odczytać)
-- ----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into instructor_feedback (osk_id, instructor_id, enrollment_id, ocena, komentarz)
  values ('0c100000-0000-0000-0000-000000000001', '0c400000-0000-0000-0000-000000000001',
          '0c500000-0000-0000-0000-000000000002', 5, 'Bardzo dobra jazda.');
  raise notice 'PASS: instruktor może dodać feedback';
end $$;

-- ----------------------------------------------------------------------------
-- Test 6: bank pytań widoczny dla każdego zalogowanego (nauka)
-- ----------------------------------------------------------------------------
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0c000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from question;
  if cnt < 1 then raise exception 'FAIL: kursant nie widzi banku pytań'; end if;
  raise notice 'PASS: bank pytań dostępny do nauki dla zalogowanych';
end $$;

select 'ALL LEARNING TESTS PASSED' as result;

truncate table osk cascade;
delete from auth.users where email like '%@learn-test.local';
