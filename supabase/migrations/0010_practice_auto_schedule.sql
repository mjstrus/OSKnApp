-- ============================================================================
-- Unit 12 (część 1/2): nowe wartości enum slot_status.
--
-- WAŻNE: Postgres nie pozwala UŻYĆ nowej wartości enuma w tej samej
-- transakcji, w której ją dodano ("unsafe use of new value"). Dlatego ta
-- migracja jest CELOWO osobnym plikiem/wykonaniem od 0011 — uruchom ją,
-- poczekaj aż się wykona (commit), dopiero potem uruchom 0011.
-- ============================================================================

alter type slot_status add value if not exists 'propozycja';
alter type slot_status add value if not exists 'wolny_gielda';
