# Czego brakuje do "profesjonalnego" działania — realny stan na dziś

Sprawdzone w kodzie, nie zgadywane: brak `.github/workflows`, brak Sentry/monitoringu błędów, brak CI. Poniżej podzielone na **musi być przed prawdziwymi klientami** i **może poczekać**.

## 1. Musi być, zanim ktokolwiek zapłaci prawdziwe pieniądze

| Brak | Ryzyko | Gdzie to naprawić |
|---|---|---|
| Zero monitoringu błędów (brak Sentry/logów) | Coś się psuje produkcyjnie i nikt się nie dowie, dopóki klient nie zadzwoni | dodać Sentry albo choćby log do tabeli `error_log` |
| `wygas_propozycje_praktyki()` woła się tylko "przy okazji" (lazy, nie cron) | Jeśli nikt nie otworzy terminarza, przeterminowana propozycja wisi martwa, blokując slot instruktora | Supabase pg_cron albo Edge Function na harmonogramie |
| Brak ręcznej korekty grafiku praktyki przez admina | Gdy auto-przydział źle dopasuje, jedyna naprawa to prosić kursanta o odwołanie | prosty widok "wszystkie sloty kursu" z edycją |
| Płatności to tylko ręczny status (`payment_status`) | Brak realnej integracji z bramką płatności — dziś to spis, nie system | Stripe/Przelewy24 albo świadomie zostaje ręczne (mniejsze OSK to akceptują) |
| Brak CI (testy/typecheck nie są wymuszane przed mergem) | Regresja wejdzie niezauważona | jeden plik `.github/workflows/ci.yml`: `npm run typecheck && npm test` |
| RODO: zgoda jest zbierana (`consent`), ale brak eksportu/usunięcia danych na żądanie | Prawny obowiązek przy realnych klientach | 2 endpointy: eksport danych kursanta, hard-delete na żądanie |
| Brak resetu hasła w UI (kursant/instruktor nie mają "zapomniałem hasła") | Support ręcznie grzebie w dashboardzie za każdym razem | `supabase.auth.resetPasswordForEmail` + jeden ekran |

## 2. Ważne, ale nie blokuje startu

- **Powiadomienia e-mail/SMS** — nic dziś nie wysyła maila (nowa propozycja jazdy, zbliżający się termin, zatwierdzone zgłoszenie). Kursant musi sam wejść do apki, żeby się dowiedzieć.
- **`theory_session` bez przypisanej sali** — grafik pokazuje godzinę, nie miejsce (sale istnieją w bazie, nie są podpięte).
- **Brak audytu/loga akcji admina** — kto i kiedy zatwierdził/usunął — przydatne przy sporze z klientem.
- **Skalowanie bundla** — build ostrzega o chunku >500kB, nieistotne przy obecnej skali, zacznie boleć przy dużym ruchu.
- **Brak testów E2E** (Playwright) — dziś tylko unit/RTL + ręczna weryfikacja w przeglądarce.

## 3. Nice-to-have, nie ruszać teraz

- Dokumenty PDF (umowa, zaświadczenie) — dziś nic nie generuje dokumentów.
- Multi-język UI (dziś tylko polski, co jest OK dla polskiego OSK).
- Panel super-admina do zarządzania wieloma OSK naraz (dziś każdy OSK jest osobny, brak widoku "właściciela sieci szkół").

---
Nie buduję niczego z tego teraz — to lista priorytetów do wyboru. Powiedz który punkt, to robię.
