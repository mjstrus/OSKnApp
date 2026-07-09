# Obsługa OSKnAPP — ściąga dla właściciela (bez żargonu)

Codziennie **tylko klikasz w przeglądarce**. Poniżej: co robisz sam, a co jest
rzadkie/jednorazowe.

## Codziennie (0 komend, tylko klikanie)

- **Wejście do apki:** otwórz adres aplikacji, zaloguj się.
- **Dodanie instruktora/wykładowcy:** panel admina → zakładka **Instruktorzy** →
  e-mail + hasło + rola → *Dodaj personel*. Potem *Godziny / przypisanie*.
- **Dodanie kursu:** zakładka **Kursy** → *Nowy kurs*.
- **Przyjęcie kursanta:** kandydat sam wypełnia formularz pod linkiem
  `/apply/<ID-kursu>`; Ty w zakładce **Kursanci** klikasz *Zatwierdź*, potem
  zaznaczasz *dopuszczony do jazd* i status płatności.
- **Konto admina dla kogoś:** patrz niżej (dashboard) — rzadkie.

## Rzadko (dashboard Supabase — klikanie, bez kodu)

Dashboard: <https://supabase.com/dashboard/project/qlpqmkqbimdwokeofyqq>

- **Nowy admin OSK / reset hasła:** *Authentication → Users*.
- **Podgląd danych:** *Table Editor*.

## Bardzo rzadko (jedna komenda — tylko gdy zmienię kod)

Te rzeczy robi zwykle Claude. Zostawione, żebyś wiedział, że to jedna komenda,
nie ciąg kroków.

- **Nowa/zmieniona logika serwera (Edge Functions):**
  ```bash
  SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE=/ścieżka/supabase.exe \
    bash scripts/deploy-functions.sh
  ```
- **Nowa tabela/zmiana bazy (migracja):** wklejasz plik z `supabase/migrations/`
  w *SQL Editor* i RUN — albo Claude robi `supabase db push`.

## Co jest gdzie (gdyby ktoś pytał)

- **Baza + logowanie + serwer logiki:** Supabase (jeden projekt w chmurze).
- **Aplikacja (to, co widzisz):** React, hostowana pod stałym adresem WWW.
- **Sekrety:** klucz `anon` jest publiczny (bezpieczny). Klucz `service_role` i
  tokeny dostępu — nigdy nie wklejaj publicznie; token po deployu kasuj.
