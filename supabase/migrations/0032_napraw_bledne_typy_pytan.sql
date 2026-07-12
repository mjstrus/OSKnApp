-- ============================================================================
-- Naprawa danych z importu 0015: 22 pytania majace w oryginalnym katalogu
-- "Zakres struktury" = SPECJALISTYCZNY, ale bez tresci w Odpowiedz A/B/C
-- (puste opcje) i "Poprawna odp" = T/N zamiast litery -- to w rzeczywistosci
-- pytania podstawowe (tak/nie), zle zaklasyfikowane w zrodle. Bez tej
-- poprawki UI pokazywalo puste opcje A/B/C zamiast TAK/NIE.
-- ============================================================================

update question
set typ = 'podstawowe'::question_type,
    poprawna = case poprawna when 'T' then 'TAK' when 'N' then 'NIE' else poprawna end
where typ = 'specjalistyczne'::question_type and opcje = '{}'::jsonb;
