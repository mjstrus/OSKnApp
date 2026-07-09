-- ============================================================================
-- Unit 9 fix: profil instruktora — imię, nazwisko, numer legitymacji (R3)
--
-- Dotąd instruktor był identyfikowany tylko przez id/typ; UI wymagał danych
-- osobowych do sensownego wyświetlania listy personelu.
-- ============================================================================

alter table instructor
  add column imie text,
  add column nazwisko text,
  add column numer_legitymacji text;
