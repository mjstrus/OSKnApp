-- ============================================================================
-- Unit 12 (część 2/2): schemat + RLS dla auto-przydziału praktyki + giełdy.
--
-- WYMAGA, żeby 0010_practice_auto_schedule.sql był już zatwierdzony (nowe
-- wartości enum 'propozycja'/'wolny_gielda' muszą istnieć przed tym plikiem).
-- ============================================================================

-- Denormalizacja course_id na slot — potrzebna dla wpisów giełdy, które
-- (chwilowo) nie mają przypisanego enrollment_id.
alter table slot add column course_id uuid;
update slot set course_id = enrollment.course_id
  from enrollment where slot.enrollment_id = enrollment.id;
alter table slot
  add constraint slot_course_fk foreign key (course_id, osk_id) references course (id, osk_id) on delete cascade;

create index slot_course_status_idx on slot (course_id, status);

alter table slot add column confirm_by timestamptz;

-- Giełda: slot bez właściciela, dopóki ktoś go nie zarezerwuje.
alter table slot alter column enrollment_id drop not null;

-- Odtwórz EXCLUDE tak, by obejmowały też propozycje/giełdę — instruktor nie
-- może mieć dwóch nakładających się slotów w żadnym z aktywnych stanów.
alter table slot drop constraint slot_instructor_no_overlap;
alter table slot add constraint slot_instructor_no_overlap
  exclude using gist (
    instructor_id with =,
    tstzrange (start_ts, end_ts) with &&
  ) where (status in ('zaplanowany', 'odbyty', 'propozycja', 'wolny_gielda'));

alter table slot drop constraint slot_enrollment_no_overlap;
alter table slot add constraint slot_enrollment_no_overlap
  exclude using gist (
    enrollment_id with =,
    tstzrange (start_ts, end_ts) with &&
  ) where (status in ('zaplanowany', 'odbyty', 'propozycja'));

-- Wygaszanie przeterminowanych propozycji — wołane leniwie (bez crona) przy
-- każdym wczytaniu terminarza kursanta/admina/generowaniu grafiku.
create or replace function public.wygas_propozycje_praktyki()
returns void
language plpgsql security definer set search_path = public as $$
begin
  update slot
    set status = 'wolny_gielda', enrollment_id = null, confirm_by = null
  where status = 'propozycja' and confirm_by < now();
end;
$$;

revoke execute on function public.wygas_propozycje_praktyki() from public, anon;
grant execute on function public.wygas_propozycje_praktyki() to authenticated, service_role;

-- Czy bieżący użytkownik jest zapisany (enrollment) na dany kurs — do
-- widoczności giełdy (nie tylko własne enrollmenty jak owns_enrollment).
create or replace function public.zapisany_na_kurs(_course_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from enrollment e
    join membership m on m.id = e.membership_id
    where e.course_id = _course_id and m.user_id = auth.uid()
  );
$$;

revoke execute on function public.zapisany_na_kurs(uuid) from public, anon;
grant execute on function public.zapisany_na_kurs(uuid) to authenticated, service_role;

-- Dodatkowa (permisywna) polityka SELECT: wpisy giełdy widzą wszyscy zapisani
-- na dany kurs, nie tylko właściciel enrollmentu (który dla giełdy i tak = null).
create policy slot_select_gielda on slot
  for select to authenticated
  using (status = 'wolny_gielda' and public.zapisany_na_kurs(course_id));
