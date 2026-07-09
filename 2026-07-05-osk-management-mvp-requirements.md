---
date: 2026-07-05
topic: osk-management-mvp
---

# System zarządzania OSK — dokument wymagań (MVP)

## Problem
Ośrodki Szkolenia Kierowców potrzebują narzędzia do prowadzenia kursów: grafiku
jazd, obecności, zliczania godzin i komunikacji z kursantami. Rynek na „nudny"
rdzeń administracyjny jest zajęty przez incumbentów (SuperPrawoJazdy, LOGICOM,
e-kierowca). Wyróżnikiem tego produktu ma być warstwa **nauki i zaangażowania**
(testy + grywalizacja), której duzi gracze nie oferują w atrakcyjnej formie.

## Model produktu i strategia
- **Land one → SaaS.** Startujemy jako narzędzie dla jednego konkretnego OSK
  (pilot/design partner), docelowo produkt SaaS sprzedawany wielu OSK-om.
- **Model danych wielo-tenantowy od startu** (każdy OSK = osobna przestrzeń),
  ale scope MVP tniemy do realnych potrzeb jednego ośrodka. Nie budujemy pełnej
  multi-tenancy w v1, ale nie zamalowujemy się w róg.
- **Wedge:** lekki rdzeń operacyjny (terminarz + zapisy/odwołania + obecność +
  zliczanie godzin) **plus** wąski plaster nauki/grywalizacji jako magnes.

## Role użytkowników
- **Kandydat / Kursant**
- **Instruktor** (praktyka, 1:1)
- **Wykładowca** (teoria, grupowo)
- **Instruktor 2w1** (teoria + praktyka)
- **Admin OSK**

## Wymagania

### A. Konfiguracja OSK (Admin)
- **R1.** Admin zakłada konto swojego OSK i zarządza jego przestrzenią.
- **R2.** Admin otwiera dostępne kursy i profiluje każdy: liczba godzin teorii i
  liczba godzin praktyki.
- **R3.** Admin przypisuje instruktorów do kursu, oznaczając rolę (wykładowca /
  instruktor praktyki / 2w1) oraz definiuje ich godziny pracy.

### B. Zapisy i onboarding kandydata
- **R4.** Kandydat wchodzi przez link zapisów na kurs i wypełnia formularz: dane
  osobowe, dane kontaktowe, kategoria, **numer PKK jako zwykłe pole tekstowe**
  (bez integracji), okna dostępności (dni/godziny), zgody RODO. Jeśli kandydat
  jest niepełnoletni — zgoda opiekuna (uwaga: od 3 marca 2026 kat. B od 17 lat,
  kurs do 3 mies. przed 17. urodzinami).
- **R5.** Lekka weryfikacja typu maker-checker: zgłoszenie kandydata trafia do
  biura/admina do zatwierdzenia przed wejściem na kurs.

### C. Terminarz (auto przy otwarciu kursu)
- **R6.** Po zamknięciu zapisów **teoria** jest auto-rozpisywana jako harmonogram
  wykładów grupowych, dobrany pod godziny pracy wykładowcy.
- **R7.** **Praktyka** działa jako *rolling booking*: system otwiera wolne sloty
  instruktora pasujące do zadeklarowanej dostępności kursanta; kursant wpina się
  w pojedyncze sloty. **Slot = 1 godzina.**
- **R8.** Kandydaci mają **48 h** na akceptację/wpięcie pierwszych jazd.
- **R9.** Terminarz jest jednocześnie **listą obecności**: instruktor potwierdza
  obecność po jeździe, co zamyka slot i dolicza godzinę do licznika.
- **R10.** Reguły blokujące (prawo, kat. B): instruktor praktyczny szkoli tylko
  jedną osobę naraz; w pierwszych 8 h jazdy nie więcej niż 2 h na raz (spełnione
  przy slotach 1 h); min. 4 h jazdy na drogach > 70 km/h.

### D. Silnik godzin / odwołań / rozliczeń
- **R11.** Liczniki per kursant: `potwierdzone` (cel: 30 h), `opłacone_pozostałe`
  (start: 30 h, w cenie kursu), `nieusprawiedliwione` (tolerancja: 1 slot),
  `dokupione`.
- **R12.** Rozliczenie każdego slotu (automat stanów):
  1. **Odbyta** → instruktor potwierdza → `potwierdzone +1`, `opłacone_pozostałe −1`.
  2. **Odwołana na czas** (w oknie) → slot wraca do puli, nic nie przepada, bez limitu.
  3. **Usprawiedliwiona po oknie** (np. choroba) → instruktor/admin oznacza ręcznie
     → traktowana jak odwołanie na czas.
  4. **Nieusprawiedliwiona #1** (tolerowana, 1 na cały kurs) → darmowe przełożenie,
     opłacona godzina **nie** przepada.
  5. **Nieusprawiedliwiona #2+** → opłacona godzina **przepada**
     (`opłacone_pozostałe −1`, `potwierdzone` bez zmian).
- **R13.** Bramka: dopuszczenie do egzaminu wewnętrznego ⇔ `potwierdzone ≥ 30`.
- **R14.** Gdy pula opłaconych godzin nie wystarcza do 30 potwierdzonych, kursant
  musi **dokupić** godziny (każda płatna osobno); dokupiona godzina zasila pulę i
  liczy się dopiero po potwierdzeniu. **W MVP dokup jest tylko rejestrowany w
  systemie, a płatność odbywa się offline (admin oznacza jako opłacone). Bramka
  płatności online → v2.**
- Okno odwołania bez konsekwencji: domyślnie **24 h** przed jazdą (konfigurowalne
  per OSK; 48 h jako bezpieczniejsza alternatywa).
- **R14a. Opłata za kurs (MVP).** Cena kursu (np. 3500 zł) rejestrowana jako status
  płatności per kursant; płatność offline, admin oznacza wpłaty/raty. Precyzyjne
  rozliczenie kwotowe i płatność online → v2.
- **R14b. Gating dostępu (MVP).** Teoria i strefa nauki otwarte po zatwierdzeniu
  zapisu. Rezerwacja jazd praktycznych za miękką flagą **„dopuszczony do jazd"**,
  ustawianą ręcznie przez admina wg umowy płatniczej z kursantem (obsługuje raty).
  Automatyczne bramkowanie po kwocie wpłat → v2.

### E. Chat
- **R15.** Chat tekstowy 1:1: kursant ↔ instruktor prowadzący jego jazdy oraz
  kursant ↔ biuro/admin.

### F. Strefa nauki + grywalizacja (wyróżnik)
- **R16.** Testy z oficjalnej bazy pytań (~3697 pytań zatwierdzonych przez
  Ministerstwo Infrastruktury): tryb nauki + tryb symulacji egzaminu WORD
  (32 pytania, 25 min, 68/74 pkt do zaliczenia, punktacja 1–3).
- **R17.** Leaderboard między kursantami jednego kursu. Domyślna metryka:
  najlepszy wynik symulacji egzaminu (tie-break: liczba ukończonych testów).
  Metryka konfigurowalna — patrz otwarte pytania.

### G. Jakość instruktora (wewnętrzne)
- **R18.** Feedback po jeździe zasila **prywatny scoring instruktora widoczny
  tylko dla admina** — nie publiczny ranking (ryzyka HR / RODO / gaming).

## Kryteria sukcesu
- Pierwszy OSK używa systemu **codziennie** do grafiku, obecności i zliczania godzin.
- Kursanci realnie korzystają ze strefy testów (adopcja wyróżnika).
- Model danych obsłuży drugi OSK bez przebudowy architektury.

## Granice scope'u (świadome non-goals MVP)
- **Integracja PKK / CEK** — osobny, późniejszy tor regulacyjny. To integracja z
  rządowym systemem KIEROWCA (CEPiK), wymaga konta OSK z numerem ewidencyjnym i
  podpisu zaufanego/kwalifikowanego przy zwrocie profilu — nie „REST na weekend".
- **Pełny optymalizator grafiku praktyki** („minimalizuj czas") — v2, gdy będzie
  realny ruch do optymalizacji.
- **Pełne e-wykłady / teoria contentowa** — v2.
- **Publiczny ranking instruktorów** — świadomie poza MVP (jakość = metryka wewn.).
- **Test wiedzy na czas z rekordem ośrodka** — poza MVP (można wrócić).
- **Cały moduł płatności online** (Przelewy24/Stripe) — v2. Obejmuje: opłatę za
  kurs, dokup godzin oraz opłatę 15 zł za apkę. W MVP wszystko rejestrowane,
  płatność offline.
- **Growth layer: opłata za apkę + program poleceń** — v2 (jedzie na bramce
  płatności). Model: kursant płaci **15 zł za apkę → kredyt na kurs** (3500 → 3485);
  15 zł zgarnia **OSK**. **Kod polecający:** za realnie zapisanego poleconego →
  punkty → wymiana na nagrody z **katalogu konfigurowalnego i finansowanego per
  OSK** (np. godzina doszkalania). Punkty naliczane dopiero po zapisie/płatności
  poleconego (anty-fraud). Rozliczenia platforma↔OSK (monetyzacja SaaS) — do
  ustalenia później.
- **Integracja EKK (Elektroniczna Karta Kursanta) + raportowanie do CEPiK** — v2 /
  tor regulacyjny. Projekt ustawy (RCL, cel przyjęcia II kw. 2026) wprowadza cyfrową
  kartę kursanta, indywidualny numer kursanta i instruktora, rejestrację jazd w
  czasie rzeczywistym, dwustronne podpisy (instruktor + kursant) w apce, zapis trasy
  GPX/GPS oraz auto-raport do Portalu Starosty/CEPiK. Wymaga apki mobilnej
  instruktora z kolejką offline/online, weryfikacji tożsamości i integracji z API
  rządowym. **Forward-compat w MVP:** obecność modelujemy jako rozszerzalne zdarzenie
  weryfikacji (start/end ts, miejsce na 2 podpisy + GPS + status synchronizacji), by
  później wchłonąć EKK bez przepisania. Zasada projektowa v2: UX apki instruktora
  musi być minimalny w kliknięciach (ryzyko sabotażu użytkowników).

## Kluczowe decyzje
- **Slot = 1 h; tolerancja = dokładnie 1 slot** na cały kurs.
- **Teoria auto-rozpisana, praktyka rolling booking** — spójne z silnikiem odwołań
  (sztywny pre-generowany grafik gryzłby się z przekładalnością slotów).
- **Jakość instruktora wewnętrznie, nie publicznie** — ograniczenie ryzyka.
- **Model danych multi-tenant-ready od startu**, scope MVP = jeden OSK.
- **Gating: teoria + nauka otwarte, jazdy za ręczną flagą admina** (obsługuje raty).
- **Cały moduł płatności + growth layer (15 zł + polecenia + nagrody) → v2.**

## Zależności / Założenia
- Dostęp do aktualnej, poprawnie sformatowanej bazy pytań + jej **synchronizacja**
  z aktualizacjami Ministerstwa. Tekst pytań jest jawny/publiczny, ale **media**
  (zdjęcia/filmy PWPW) mogą nieść osobne prawa — potrzebny czysty/licencjonowany
  kanał (do potwierdzenia; to nie jest porada prawna). **Uwaga: baza pytań się
  zmienia** — projekt ustawy ogranicza ją z ~3500 do ~1500 pytań, a opracowaniem
  zajmie się nowe Centrum Egzaminowania (ITS). Model pytań musi być elastyczny;
  nie zaszywać sztywno liczby ani struktury.

## Otwarte pytania

### Do rozwiązania przed planowaniem
- Brak — wszystkie rozstrzygnięte. Gotowe do planowania.

### Odroczone do planowania
- **[R7][Techniczne]** Model danych dostępności (instruktor/kursant) i mechanika
  otwierania slotów praktyki.
- **[R16][Wymaga researchu]** Kanał pozyskania i status licencyjny bazy pytań oraz
  mediów PWPW.
- **[R17][Decyzja/Techniczne]** Ostateczna metryka i zasady leaderboardu.
- **[Techniczne]** Wybór stacku i konkretna architektura multi-tenant.
- **[R16][Techniczne]** Dokładny format symulacji egzaminu per kategoria (dobór i
  waga pytań).

## Następne kroki
→ Rozwiąż pytanie o płatności (jedyne „do rozwiązania przed planowaniem"),
potem `→ /dev-plan` do planowania technicznego implementacji.
