-- ============================================================================
-- Unit 1: Polityki RLS — izolacja tenantów + zakres per rola
--
-- Zasady:
--  * Każda tabela tenant-scoped filtrowana po osk_id przez membership
--    bieżącego użytkownika (auth.uid()).
--  * Zapis do danych konfiguracyjnych OSK tylko dla roli 'admin'.
--  * Kursant widzi wyłącznie własny enrollment; admin widzi wszystko w swoim OSK.
--  * Funkcje pomocnicze są SECURITY DEFINER, żeby uniknąć rekursji RLS na
--    membership (właściciel tabeli omija RLS, dopóki nie użyto FORCE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Funkcje pomocnicze
-- ----------------------------------------------------------------------------

create or replace function public.is_member_of(_osk_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from membership m
    where m.osk_id = _osk_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.member_role(_osk_id uuid)
returns membership_role
language sql stable security definer
set search_path = public
as $$
  select m.rola from membership m
  where m.osk_id = _osk_id and m.user_id = auth.uid();
$$;

create or replace function public.is_admin_of(_osk_id uuid)
returns boolean
language sql stable
as $$
  select public.member_role(_osk_id) = 'admin';
$$;

-- Czy dany membership należy do bieżącego użytkownika (np. własny enrollment).
create or replace function public.is_own_membership(_membership_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from membership m
    where m.id = _membership_id and m.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- Bootstrap tenanta (R1): nowy użytkownik zakłada OSK i staje się jego adminem.
-- SECURITY DEFINER, bo przed powstaniem membership nie przejdzie żadna polityka.
-- ----------------------------------------------------------------------------
create or replace function public.create_osk(_nazwa text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  _osk_id uuid;
begin
  if auth.uid() is null then
    raise exception 'create_osk wymaga zalogowanego użytkownika';
  end if;
  insert into osk (nazwa) values (_nazwa) returning id into _osk_id;
  insert into membership (osk_id, user_id, rola)
  values (_osk_id, auth.uid(), 'admin');
  return _osk_id;
end;
$$;

revoke execute on function public.create_osk(text) from public, anon;
grant execute on function public.create_osk(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Uprawnienia bazowe (na Supabase nadawane domyślnie; jawnie dla parytetu
-- z lokalnym Postgresem testowym). RLS i tak ogranicza widoczne wiersze.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ----------------------------------------------------------------------------
-- RLS: włączenie na wszystkich tabelach tenant-scoped
-- ----------------------------------------------------------------------------
alter table osk enable row level security;
alter table membership enable row level security;
alter table course enable row level security;
alter table instructor enable row level security;
alter table course_instructor enable row level security;
alter table working_hours enable row level security;
alter table enrollment enable row level security;

-- ----------------------------------------------------------------------------
-- osk: członek widzi swój OSK; tylko admin edytuje.
-- INSERT wyłącznie przez create_osk(); DELETE tylko service_role.
-- ----------------------------------------------------------------------------
create policy osk_select_member on osk
  for select to authenticated
  using (public.is_member_of(id));

create policy osk_update_admin on osk
  for update to authenticated
  using (public.is_admin_of(id))
  with check (public.is_admin_of(id));

-- ----------------------------------------------------------------------------
-- membership: użytkownik widzi własne członkostwa; admin widzi i zarządza
-- członkostwami swojego OSK.
-- ----------------------------------------------------------------------------
create policy membership_select_own on membership
  for select to authenticated
  using (user_id = auth.uid());

create policy membership_select_admin on membership
  for select to authenticated
  using (public.is_admin_of(osk_id));

create policy membership_insert_admin on membership
  for insert to authenticated
  with check (public.is_admin_of(osk_id));

create policy membership_update_admin on membership
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy membership_delete_admin on membership
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- ----------------------------------------------------------------------------
-- course: każdy członek OSK czyta; tylko admin pisze (R2).
-- ----------------------------------------------------------------------------
create policy course_select_member on course
  for select to authenticated
  using (public.is_member_of(osk_id));

create policy course_insert_admin on course
  for insert to authenticated
  with check (public.is_admin_of(osk_id));

create policy course_update_admin on course
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy course_delete_admin on course
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- ----------------------------------------------------------------------------
-- instructor: każdy członek OSK czyta; tylko admin pisze (R3).
-- ----------------------------------------------------------------------------
create policy instructor_select_member on instructor
  for select to authenticated
  using (public.is_member_of(osk_id));

create policy instructor_insert_admin on instructor
  for insert to authenticated
  with check (public.is_admin_of(osk_id));

create policy instructor_update_admin on instructor
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy instructor_delete_admin on instructor
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- ----------------------------------------------------------------------------
-- course_instructor: każdy członek OSK czyta; tylko admin pisze (R3).
-- ----------------------------------------------------------------------------
create policy course_instructor_select_member on course_instructor
  for select to authenticated
  using (public.is_member_of(osk_id));

create policy course_instructor_insert_admin on course_instructor
  for insert to authenticated
  with check (public.is_admin_of(osk_id));

create policy course_instructor_update_admin on course_instructor
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy course_instructor_delete_admin on course_instructor
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- ----------------------------------------------------------------------------
-- working_hours: każdy członek OSK czyta (potrzebne do wyliczania dostępności);
-- tylko admin pisze (R3).
-- ----------------------------------------------------------------------------
create policy working_hours_select_member on working_hours
  for select to authenticated
  using (public.is_member_of(osk_id));

create policy working_hours_insert_admin on working_hours
  for insert to authenticated
  with check (public.is_admin_of(osk_id));

create policy working_hours_update_admin on working_hours
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy working_hours_delete_admin on working_hours
  for delete to authenticated
  using (public.is_admin_of(osk_id));

-- ----------------------------------------------------------------------------
-- enrollment: kursant widzi tylko własny zapis; admin widzi wszystkie w OSK.
-- Zapis tworzony/zmieniany przez admina (maker-checker w Unit 4 przejdzie
-- przez Edge Function z service_role).
-- ----------------------------------------------------------------------------
create policy enrollment_select_own_or_admin on enrollment
  for select to authenticated
  using (
    public.is_own_membership(membership_id)
    or public.is_admin_of(osk_id)
  );

create policy enrollment_insert_admin on enrollment
  for insert to authenticated
  with check (public.is_admin_of(osk_id));

create policy enrollment_update_admin on enrollment
  for update to authenticated
  using (public.is_admin_of(osk_id))
  with check (public.is_admin_of(osk_id));

create policy enrollment_delete_admin on enrollment
  for delete to authenticated
  using (public.is_admin_of(osk_id));
