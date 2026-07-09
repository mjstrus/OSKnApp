-- ============================================================================
-- Giełda wolnych terminów: wielu kandydatów, admin wybiera (nie "kto pierwszy").
--
-- Kursant zgłasza zainteresowanie slotem 'wolny_gielda' (nie zajmuje go od razu).
-- Admin widzi wszystkich kandydatów per slot i zatwierdza jednego — reszta
-- zgłoszeń dla tego slotu odpada automatycznie. Mutacje idą przez Edge
-- Functions (service_role), jak reszta cyklu slotu — RLS tu daje tylko odczyt.
-- ============================================================================

create table gielda_zgloszenie (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  slot_id uuid not null references slot (id) on delete cascade,
  enrollment_id uuid not null references enrollment (id) on delete cascade,
  status text not null default 'oczekuje', -- 'oczekuje' | 'zatwierdzone' | 'odrzucone'
  created_at timestamptz not null default now(),
  unique (slot_id, enrollment_id)
);

create index gielda_zgloszenie_slot_idx on gielda_zgloszenie (slot_id, status);
create index gielda_zgloszenie_enrollment_idx on gielda_zgloszenie (enrollment_id);

alter table gielda_zgloszenie enable row level security;

create policy gielda_zgloszenie_admin_all on gielda_zgloszenie
  for all using (public.is_admin_of(osk_id)) with check (public.is_admin_of(osk_id));

create policy gielda_zgloszenie_own_select on gielda_zgloszenie
  for select using (public.owns_enrollment(enrollment_id));
