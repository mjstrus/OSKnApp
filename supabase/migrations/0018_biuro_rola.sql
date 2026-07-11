-- ============================================================================
-- Pracownik biurowy (rola 'biuro'): admin może dodać usera bez konta
-- instruktora, z ograniczeniem widoczności zakładek do wybranych sekcji.
-- Ustalone z userem: ograniczenie TYLKO na poziomie UI (front chowa zakładki
-- + blokuje bezpośrednie wejście po URL), bez zmian RLS — świadomy kompromis
-- (zaufany pracownik małego OSK), nie przepisujemy dziesiątek polityk admina.
-- ============================================================================

alter type membership_role add value if not exists 'biuro';

alter table membership add column imie text;
alter table membership add column nazwisko text;
alter table membership add column uprawnienia text[] not null default '{}';
