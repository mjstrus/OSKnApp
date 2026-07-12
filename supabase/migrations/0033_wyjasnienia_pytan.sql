-- ============================================================================
-- Wyjasnienia do pytan podstawowych (tak/nie) bez multimediow -- podstawa
-- prawna + krotkie uzasadnienie, generowane przez LLM na bazie tresci pytania
-- i znanych przepisow (Ustawa Prawo o ruchu drogowym). Kazdy wiersz ma flage
-- zweryfikowane=false -- user zapowiedzial rewizje przez instruktorow z
-- doswiadczeniem, to NIE jest traktowane jako ostateczne zrodlo prawdy.
-- ============================================================================

alter table question add column wyjasnienie text;
alter table question add column wyjasnienie_zweryfikowane boolean not null default false;
