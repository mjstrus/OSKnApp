-- ============================================================================
-- Unit 10: rozszerzenie kursu (termin/limity/auto-zamknięcie), sale wykładowe,
-- flota aut — dane wejściowe dla silnika weryfikacji pojemności kursu
-- (src/engine/capacity.ts).
-- ============================================================================

alter table course
  add column data_poczatku date,
  add column docelowy_czas_dni integer,
  add column min_uczestnicy integer not null default 1,
  add column max_uczestnicy integer,
  add column powiadomienie_przy_liczbie integer,
  add column auto_zamknij_przy_limicie boolean not null default false,
  add column auto_zamknij_po_dniach integer,
  add column ogloszono_ts timestamptz not null default now();

-- Sale wykładowe: nazwa + adres (do wyświetlenia na grafiku kursanta) + pojemność.
create table room (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk(id) on delete cascade,
  nazwa text not null,
  adres text,
  pojemnosc integer not null check (pojemnosc > 0),
  created_at timestamptz not null default now()
);

-- Flota aut — zasób NIEZALEŻNY od instruktorów (jeden instruktor może jeździć
-- różnymi autami); limity serwisowe w km ustawiane indywidualnie przez admina.
create table vehicle (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk(id) on delete cascade,
  nr_rejestracyjny text not null,
  marka_model text,
  przeglad_do date,
  ubezpieczenie_do date,
  przebieg_biezacy integer not null default 0,
  serwis_ostatni_przebieg integer not null default 0,
  serwis_limit_km integer not null default 15000 check (serwis_limit_km > 0),
  aktywny boolean not null default true,
  created_at timestamptz not null default now(),
  unique (osk_id, nr_rejestracyjny)
);

alter table room enable row level security;
alter table vehicle enable row level security;

create policy room_select_member on room
  for select using (public.is_member_of(osk_id));
create policy room_admin_all on room
  for all using (public.is_admin_of(osk_id)) with check (public.is_admin_of(osk_id));

create policy vehicle_select_member on vehicle
  for select using (public.is_member_of(osk_id));
create policy vehicle_admin_all on vehicle
  for all using (public.is_admin_of(osk_id)) with check (public.is_admin_of(osk_id));
