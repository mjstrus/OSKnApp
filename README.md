# OSKnAPP — SaaS do zarządzania Ośrodkiem Szkolenia Kierowców

Multi-tenantowy SaaS (Supabase + React). Plan implementacji:
[2026-07-05-001-feat-osk-management-mvp-plan.md](2026-07-05-001-feat-osk-management-mvp-plan.md).

## Struktura

- `supabase/migrations/` — schema i polityki RLS (źródło prawdy dla bazy)
  - `0001_tenancy_and_core.sql` — tabele rdzeniowe: `osk`, `membership`, `course`,
    `instructor`, `course_instructor`, `working_hours`, `enrollment`
  - `0002_rls_policies.sql` — izolacja tenantów po `osk_id`, zakresy per rola,
    funkcje pomocnicze i bootstrap `create_osk()`
  - `0003_slots_availability.sql` — terminarz: `slot` (z constraintami `EXCLUDE`
    przeciw double-bookingowi), `availability`, `theory_session`,
    `attendance_event` (EKK-ready) + `enrollment.cleared_to_drive` (R14b) i RLS
  - `0004_onboarding_payments.sql` — `candidate_application`, `consent`,
    `enrollment.payment_status`/`cena`/`wplacono` (R14a) + RPC
    `approve_application` (maker-checker, R5) i `reject_application`
  - `0005_learning_gamification.sql` — `question` (globalny bank), `test_attempt`,
    `answer`, `instructor_feedback` (prywatny scoring, R18) + RLS widoczności
    leaderboardu i seed pytań
  - `0006_chat.sql` — `chat_message` (1:1) + RLS uczestników + publikacja Realtime (R15)
- `supabase/functions/` — Edge Functions (Deno): `book-slot` (transakcyjna
  rezerwacja), `generate-theory` (auto-harmonogram teorii), `submit-application`
  (publiczne zgłoszenie), `approve-application` (maker-checker), `confirm-attendance`
  (obecność, R9), `cancel-slot` (odwołanie z oknem, R7/R12), `create-staff`
  (admin dodaje personel: konto+membership+instruktor); cienkie warstwy nad
  `src/engine/`
- `supabase/tests/` — testy SQL: izolacja RLS + guardrail rezerwacji
- `src/engine/` — framework-agnostyczny rdzeń (czysty TS, testy Vitest)
  - `hours.ts` — liczniki godzin, automat stanów slotu, bramka ≥30, dokup (R11–R14a)
  - `scheduling.ts` — algebra interwałów, dostępność, walidacja rezerwacji,
    auto-teoria (R6–R10)
  - `onboarding.ts` — walidacja kompletności zgłoszenia: wiek, zgody, pola (R4)
  - `exam.ts` — dobór pytań i punktacja symulacji WORD 32/25min/68/74 (R16)
  - `leaderboard.ts` — ranking kursu po najlepszym wyniku, tie-break (R17)
- `src/app/` — router (routing zależny od roli, trasy publiczne/chronione), Panel
- `src/features/auth/` — `AuthProvider` (sesja + rola z `membership`), `LoginPage`
- `src/features/onboarding/` — `ApplicationForm` (publiczny formularz zapisów, R4)
  spięty z Edge Function `submit-application`
- `src/features/admin/` — konfiguracja OSK: kursy, godziny pracy, zamykanie zapisów
  (auto-teoria), maker-checker zgłoszeń, flaga „dopuszczony do jazd" (R1–R3, R6, R14b)
- `src/features/schedule/` — terminarz per rola: rezerwacja/odwołanie (kursant),
  potwierdzanie obecności (instruktor); `availability.ts` liczy wolne sloty silnikiem
- `src/features/progress/` — `HoursProgress` (pasek „X / cel h", R13)
- `src/features/learning/` — `ExamSimulation` (WORD 32/25min/68/74, R16) + zapis podejść
- `src/features/leaderboard/` — `LeaderboardView` (ranking kursu, R17)
- `src/features/chat/` — `ChatWindow` + Realtime (czat 1:1, R15)
- `src/features/admin/InstructorScoring.tsx` — prywatny scoring instruktora (R18, admin)
- `src/components/ui/` — komponenty shadcn-style (button, input, label, card)
- `e2e/` — testy Playwright (onboarding)
- `src/lib/supabase.ts` — klient Supabase dla frontendu

## Frontend (dev)

```bash
npm run dev       # Vite dev server (wymaga .env z URL + kluczem anon)
npm run build     # tsc --noEmit + vite build
```

Stack: Vite 6 + React 19 + TailwindCSS v4 + shadcn-style UI. Trasy: `/login`,
`/apply/:courseId` (publiczna), `/panel` (chroniona, dashboard per rola).

## Testy silnika (Vitest)

Wymaga Node.js. `npm install`, potem:

```bash
npm test         # 109 testów: silnik + availability + komponenty UI (RTL)
npm run typecheck
```

## Model multi-tenant

Jeden projekt Supabase, wspólna schema. Każda tabela tenant-scoped ma kolumnę
`osk_id`; izolację egzekwuje RLS na bazie `membership` (user ↔ osk ↔ rola).
Spójność tenanta między tabelami wymuszają złożone klucze obce `(id, osk_id)`.
Role: `kandydat`, `kursant`, `instruktor`, `wykladowca`, `instruktor_2w1`, `admin`.

Nowy OSK zakłada się przez RPC `create_osk(nazwa)` — tworzy tenanta i nadaje
założycielowi rolę `admin` w jednej transakcji.

## Wdrożenie na projekt Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com) (lub `supabase start`
   lokalnie — wymaga Dockera).
2. `supabase link --project-ref <ref>` i `supabase db push` (albo wklej migracje
   po kolei w SQL Editorze).
3. Skopiuj `.env.example` → `.env` i uzupełnij URL + klucz anon z dashboardu.

## Testy izolacji RLS

Wymagany `psql` i świeża baza Postgres.

```bash
# na lokalnym stacku Supabase (supabase start):
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  bash supabase/tests/run_rls_tests.sh

# na czystym Postgresie (bez Supabase) — najpierw shim auth:
APPLY_LOCAL_AUTH_SHIM=1 DATABASE_URL=postgresql://postgres@127.0.0.1:5432/rls_test \
  bash supabase/tests/run_rls_tests.sh
```

Testy pokrywają: izolację cross-tenant na wszystkich tabelach, niewidoczność
cudzego `enrollment` dla kursanta, pełny zakres admina w obrębie własnego OSK,
brak praw zapisu kursanta do konfiguracji, użytkownika bez membershipu, `anon`,
`service_role` (bypass) i bootstrap `create_osk`.
