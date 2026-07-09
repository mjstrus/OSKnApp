-- ============================================================================
-- Unit 4: Testy onboardingu — maker-checker (R5) i gating jazd (R14b)
--
-- Scenariusze z planu:
--  * Zgłoszenie pending nie daje dostępu (brak enrollmentu).
--  * Tylko admin może zatwierdzić (maker-checker).
--  * Admin zatwierdza → powstaje enrollment (cleared_to_drive=false), dostępność
--    skopiowana, zgłoszenie 'approved'; ustawienie flagi otwiera jazdy.
--
-- (Kompletność zgłoszenia — wiek/zgody — pokrywa Vitest: onboarding.test.ts.)
-- Uruchamiane po migracjach przez run_rls_tests.sh.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

truncate table osk cascade;
delete from auth.users where email like '%@onb-test.local';

insert into auth.users (id, email) values
  ('0b000000-0000-0000-0000-000000000001', 'admin@onb-test.local'),
  ('0b000000-0000-0000-0000-000000000002', 'kandydat@onb-test.local'),
  ('0b000000-0000-0000-0000-000000000003', 'obcy@onb-test.local');

insert into osk (id, nazwa) values ('0b100000-0000-0000-0000-000000000001', 'OSK Onboarding');

insert into membership (id, osk_id, user_id, rola) values
  ('0b200000-0000-0000-0000-000000000001', '0b100000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001', 'admin'),
  ('0b200000-0000-0000-0000-000000000003', '0b100000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000003', 'kursant');

insert into course (id, osk_id, nazwa, h_teoria, h_praktyka) values
  ('0b300000-0000-0000-0000-000000000001', '0b100000-0000-0000-0000-000000000001', 'Kurs B', 30, 30);

insert into candidate_application
  (id, osk_id, course_id, imie, nazwisko, email, telefon, pkk_number, data_urodzenia, dostepnosc)
values
  ('0b400000-0000-0000-0000-000000000001', '0b100000-0000-0000-0000-000000000001',
   '0b300000-0000-0000-0000-000000000001', 'Anna', 'Nowak', 'anna@onb-test.local',
   '600100200', 'PKK/2026/1', '2000-05-01',
   '[{"start_ts":"2026-07-06T08:00:00+02:00","end_ts":"2026-07-06T12:00:00+02:00"}]'::jsonb);

commit;

-- ----------------------------------------------------------------------------
-- Test 1: zgłoszenie pending nie utworzyło jeszcze enrollmentu
-- ----------------------------------------------------------------------------
do $$
declare cnt bigint;
begin
  select count(*) into cnt from enrollment where osk_id = '0b100000-0000-0000-0000-000000000001';
  if cnt <> 0 then raise exception 'FAIL: istnieje enrollment mimo pending zgłoszenia'; end if;
  raise notice 'PASS: pending nie daje enrollmentu';
end $$;

-- ----------------------------------------------------------------------------
-- Test 2: nie-admin nie może zatwierdzić (maker-checker)
-- ----------------------------------------------------------------------------
do $$
declare denied boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0b000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.approve_application(
      '0b400000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000002');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'FAIL: nie-admin zatwierdził zgłoszenie'; end if;
  raise notice 'PASS: akceptacja wymaga admina';
end $$;

-- ----------------------------------------------------------------------------
-- Test 3: admin zatwierdza → enrollment + dostępność + status approved
-- ----------------------------------------------------------------------------
do $$
declare
  _enr uuid;
  _cleared boolean;
  _pay text;
  _status text;
  _avail bigint;
  _rola text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0b000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  _enr := public.approve_application(
    '0b400000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000002');
  if _enr is null then raise exception 'FAIL: approve nie zwrócił enrollmentu'; end if;

  select cleared_to_drive, payment_status::text into _cleared, _pay
  from enrollment where id = _enr;
  if _cleared is not false then raise exception 'FAIL: cleared_to_drive powinno być false po akceptacji'; end if;
  if _pay <> 'nieoplacony' then raise exception 'FAIL: domyślny payment_status powinien być nieoplacony'; end if;

  select rola::text into _rola from membership m
  join enrollment e on e.membership_id = m.id where e.id = _enr;
  if _rola <> 'kursant' then raise exception 'FAIL: nowy członek nie ma roli kursant (%).', _rola; end if;

  select status::text into _status from candidate_application
  where id = '0b400000-0000-0000-0000-000000000001';
  if _status <> 'approved' then raise exception 'FAIL: zgłoszenie nie jest approved (%).', _status; end if;

  select count(*) into _avail from availability where enrollment_id = _enr;
  if _avail <> 1 then raise exception 'FAIL: dostępność nie skopiowana (%).', _avail; end if;

  raise notice 'PASS: maker-checker tworzy enrollment(kursant), gating domyślnie zamknięty, dostępność skopiowana';
end $$;

-- ----------------------------------------------------------------------------
-- Test 4: ponowna akceptacja tego samego zgłoszenia jest odrzucana (idempotencja)
-- ----------------------------------------------------------------------------
do $$
declare denied boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0b000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.approve_application(
      '0b400000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000002');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'FAIL: druga akceptacja przeszła'; end if;
  raise notice 'PASS: nie można zatwierdzić dwa razy';
end $$;

-- ----------------------------------------------------------------------------
-- Test 5: gating — admin otwiera jazdy ustawiając cleared_to_drive
-- ----------------------------------------------------------------------------
do $$
declare _cleared boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0b000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;

  update enrollment set cleared_to_drive = true
  where id = (select enrollment_id from candidate_application
              where id = '0b400000-0000-0000-0000-000000000001');

  select cleared_to_drive into _cleared from enrollment
  where id = (select enrollment_id from candidate_application
              where id = '0b400000-0000-0000-0000-000000000001');
  if _cleared is not true then raise exception 'FAIL: admin nie ustawił cleared_to_drive'; end if;
  raise notice 'PASS: admin otwiera jazdy flagą cleared_to_drive';
end $$;

select 'ALL ONBOARDING TESTS PASSED' as result;

truncate table osk cascade;
delete from auth.users where email like '%@onb-test.local';
