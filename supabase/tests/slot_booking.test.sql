-- ============================================================================
-- Unit 3: Test guardrailu DB przeciw double-bookingowi (constrainty EXCLUDE)
--
-- Weryfikuje scenariusz z planu: „brak double-bookingu pod współbieżnością".
-- Constrainty EXCLUDE na tabeli slot serializują nakładające się rezerwacje na
-- indeksie GiST — druga kolidująca wstawka jest odrzucana niezależnie od tego,
-- czy przyszła równolegle, czy sekwencyjnie. Testujemy jako właściciel tabel.
--
-- Uruchamiane po migracjach przez run_rls_tests.sh.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

truncate table osk cascade;
delete from auth.users where email like '%@slot-test.local';

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@slot-test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'kursant1@slot-test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'kursant2@slot-test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'instruktor@slot-test.local');

insert into osk (id, nazwa) values ('05000000-0000-0000-0000-000000000001', 'OSK Slot-Test');

insert into membership (id, osk_id, user_id, rola) values
  ('05100000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('05100000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'kursant'),
  ('05100000-0000-0000-0000-000000000003', '05000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'kursant'),
  ('05100000-0000-0000-0000-000000000004', '05000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'instruktor');

insert into course (id, osk_id, nazwa, h_teoria, h_praktyka) values
  ('05200000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001', 'Kurs B', 30, 30);

insert into instructor (id, osk_id, membership_id, typ) values
  ('05300000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001', '05100000-0000-0000-0000-000000000004', 'instruktor_praktyki');

insert into enrollment (id, osk_id, course_id, membership_id, cleared_to_drive) values
  ('05400000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001', '05200000-0000-0000-0000-000000000001', '05100000-0000-0000-0000-000000000002', true),
  ('05400000-0000-0000-0000-000000000002', '05000000-0000-0000-0000-000000000001', '05200000-0000-0000-0000-000000000001', '05100000-0000-0000-0000-000000000003', true);

commit;

-- ----------------------------------------------------------------------------
-- Test 1: pierwsza rezerwacja przechodzi
-- ----------------------------------------------------------------------------
insert into slot (id, osk_id, enrollment_id, instructor_id, start_ts, end_ts) values
  ('05500000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001',
   '05400000-0000-0000-0000-000000000001', '05300000-0000-0000-0000-000000000001',
   '2026-07-06 09:00+02', '2026-07-06 10:00+02');

-- ----------------------------------------------------------------------------
-- Test 2: drugi kursant NIE zarezerwuje tego samego okna tego samego instruktora
-- ----------------------------------------------------------------------------
do $$
declare denied boolean := false;
begin
  begin
    insert into slot (osk_id, enrollment_id, instructor_id, start_ts, end_ts) values
      ('05000000-0000-0000-0000-000000000001', '05400000-0000-0000-0000-000000000002',
       '05300000-0000-0000-0000-000000000001', '2026-07-06 09:00+02', '2026-07-06 10:00+02');
  exception when exclusion_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: double-booking instruktora przeszedł'; end if;
  raise notice 'PASS: kolizja u instruktora (1:1) zablokowana przez EXCLUDE';
end $$;

-- ----------------------------------------------------------------------------
-- Test 3: częściowe nakładanie też blokowane (09:30–10:30 na zajętym 09:00–10:00)
-- ----------------------------------------------------------------------------
do $$
declare denied boolean := false;
begin
  begin
    insert into slot (osk_id, enrollment_id, instructor_id, start_ts, end_ts) values
      ('05000000-0000-0000-0000-000000000001', '05400000-0000-0000-0000-000000000002',
       '05300000-0000-0000-0000-000000000001', '2026-07-06 09:30+02', '2026-07-06 10:30+02');
  exception when exclusion_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: częściowe nakładanie u instruktora przeszło'; end if;
  raise notice 'PASS: częściowe nakładanie zablokowane';
end $$;

-- ----------------------------------------------------------------------------
-- Test 4: ten sam kursant nie może mieć dwóch slotów w tym samym czasie
--          (nawet u innego instruktora) — enrollment_no_overlap
-- ----------------------------------------------------------------------------
do $$
declare
  denied boolean := false;
  inny_instruktor uuid := '05300000-0000-0000-0000-000000000009';
begin
  insert into instructor (id, osk_id, membership_id, typ)
  values (inny_instruktor, '05000000-0000-0000-0000-000000000001',
          '05100000-0000-0000-0000-000000000001', 'instruktor_2w1');

  begin
    insert into slot (osk_id, enrollment_id, instructor_id, start_ts, end_ts) values
      ('05000000-0000-0000-0000-000000000001', '05400000-0000-0000-0000-000000000001',
       inny_instruktor, '2026-07-06 09:00+02', '2026-07-06 10:00+02');
  exception when exclusion_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: kursant zarezerwował dwa sloty naraz'; end if;
  raise notice 'PASS: kursant nie może być w dwóch miejscach naraz';
end $$;

-- ----------------------------------------------------------------------------
-- Test 5: sąsiadujący slot (10:00–11:00) NIE koliduje (styk krawędzią)
-- ----------------------------------------------------------------------------
insert into slot (osk_id, enrollment_id, instructor_id, start_ts, end_ts) values
  ('05000000-0000-0000-0000-000000000001', '05400000-0000-0000-0000-000000000002',
   '05300000-0000-0000-0000-000000000001', '2026-07-06 10:00+02', '2026-07-06 11:00+02');
do $$ begin raise notice 'PASS: sąsiadujący slot (styk krawędzią) dozwolony'; end $$;

-- ----------------------------------------------------------------------------
-- Test 6: odwołanie slotu zwalnia czas do ponownej rezerwacji
-- ----------------------------------------------------------------------------
do $$
begin
  update slot set status = 'odwolany_w_oknie'
  where id = '05500000-0000-0000-0000-000000000001';

  -- teraz 09:00–10:00 u tego instruktora jest znów wolne
  insert into slot (osk_id, enrollment_id, instructor_id, start_ts, end_ts) values
    ('05000000-0000-0000-0000-000000000001', '05400000-0000-0000-0000-000000000002',
     '05300000-0000-0000-0000-000000000001', '2026-07-06 09:00+02', '2026-07-06 10:00+02');
  raise notice 'PASS: odwołany slot zwalnia czas (WHERE w EXCLUDE)';
end $$;

select 'ALL SLOT BOOKING TESTS PASSED' as result;

-- Sprzątanie po teście, by nie zaśmiecać kolejnych uruchomień.
truncate table osk cascade;
delete from auth.users where email like '%@slot-test.local';
