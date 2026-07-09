-- ============================================================================
-- #3: pg_cron zamiast leniwego wygaszania propozycji praktyki.
-- #4: lekki log błędów zamiast zewnętrznego Sentry (zero nowej zależności/konta).
-- #8: RODO — eksport i usunięcie danych kursanta na żądanie.
-- #2: układ widgetów w DB (cross-device) zamiast tylko localStorage.
-- ============================================================================

-- #3: co 15 minut wygaś przeterminowane propozycje (funkcja już istnieje z 0011).
create extension if not exists pg_cron;
select cron.schedule('wygas-propozycje-praktyki', '*/15 * * * *', $$select public.wygas_propozycje_praktyki()$$);

-- #4: log błędów frontendu — admin widzi w Ustawieniach zamiast dowiadywać się od klienta.
create table error_log (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid references osk (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kontekst text not null,
  wiadomosc text not null,
  stack text,
  created_at timestamptz not null default now()
);
create index error_log_osk_id_idx on error_log (osk_id, created_at desc);

alter table error_log enable row level security;
-- Każdy zalogowany może zapisać błąd (własny, może nie mieć jeszcze osk_id
-- jeśli np. błąd wystąpił przed przypisaniem roli) — odczyt tylko admin.
create policy error_log_insert_any on error_log
  for insert to authenticated with check (true);
create policy error_log_select_admin on error_log
  for select using (osk_id is not null and public.is_admin_of(osk_id));

-- #8: RODO — eksport własnych danych (SECURITY DEFINER, zwraca JSON, tylko własne).
create or replace function public.eksportuj_moje_dane()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  wynik jsonb;
begin
  select jsonb_build_object(
    'membership', (select jsonb_agg(to_jsonb(m)) from membership m where m.user_id = auth.uid()),
    'enrollment', (
      select jsonb_agg(to_jsonb(e)) from enrollment e
      join membership m on m.id = e.membership_id
      where m.user_id = auth.uid()
    ),
    'sloty', (
      select jsonb_agg(to_jsonb(s)) from slot s
      join enrollment e on e.id = s.enrollment_id
      join membership m on m.id = e.membership_id
      where m.user_id = auth.uid()
    ),
    'dostepnosc', (
      select jsonb_agg(to_jsonb(a)) from availability a
      join enrollment e on e.id = a.enrollment_id
      join membership m on m.id = e.membership_id
      where m.user_id = auth.uid()
    )
  ) into wynik;
  return wynik;
end;
$$;
revoke execute on function public.eksportuj_moje_dane() from public, anon;
grant execute on function public.eksportuj_moje_dane() to authenticated;

-- #8: RODO — usunięcie własnego konta i wszystkich powiązanych danych.
-- Kaskady w membership/enrollment/slot itd. już istnieją (on delete cascade) —
-- wystarczy usunąć wiersze membership należące do wołającego w bieżącym OSK.
create or replace function public.usun_moje_dane(_osk_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from membership where user_id = auth.uid() and osk_id = _osk_id;
end;
$$;
revoke execute on function public.usun_moje_dane(uuid) from public, anon;
grant execute on function public.usun_moje_dane(uuid) to authenticated;

-- #2: układ widgetów w DB — cross-device zamiast tylko localStorage.
-- UWAGA: celowo OSOBNA tabela, nie kolumna na membership — RLS jest na
-- poziomie wiersza, nie kolumny; self-update membership pozwoliłby userowi
-- nadpisać sobie też pole `rola` (eskalacja uprawnień). Osobna tabela = self-
-- update dotyczy tylko układu widgetów, zero ryzyka.
create table widget_layout (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  uklad jsonb not null,
  updated_at timestamptz not null default now(),
  unique (osk_id, user_id)
);

alter table widget_layout enable row level security;
create policy widget_layout_own on widget_layout
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
