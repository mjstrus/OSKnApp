# Role i odpowiedzialności — OSKnAPP

Trzy role w systemie: **admin** (właściciel OSK), **instruktor/wykładowca** (pracownik), **kursant** (klient). Poniżej: kto ma dostęp do czego, gdzie to widać w UI, i kto faktycznie odpowiada za wynik danej akcji.

## Admin (właściciel OSK)

Panel: `AdminPanel.tsx` → zakładki Pulpit / Kursy / Instruktorzy / Kursanci / Ustawienia.

| Funkcja | Gdzie w UI | Za co odpowiada |
|---|---|---|
| Pulpit (kafelki: kursy, zgłoszenia, terminy floty) | `Dashboard.tsx` | Ma widzieć stan OSK bez klikania po zakładkach |
| Zakładanie kursu (godziny, limity, termin) | `CourseForm.tsx` | Poprawność oferty — silnik `capacity.ts` tylko ostrzega, nie blokuje |
| Zamknięcie zapisów, generowanie grafiku teorii | `CourseDetail.tsx` | Decyzja "kiedy zamykamy nabór" jest ręczna, generowanie automatyczne |
| Generowanie propozycji jazd praktycznych | `CourseDetail.tsx` | Wyzwala dopasowanie, ale **nie** zatwierdza go za kursanta — to robi kursant |
| Zatwierdzanie zgłoszeń kandydatów (maker-checker) | `ApplicationsAndEnrollments.tsx` | Jedyna rola mogąca tworzyć konto kursanta z formularza |
| Dopuszczenie do jazd (`cleared_to_drive`), status płatności | `EnrollmentsSection.tsx` | Ręczna decyzja — system tego nie automatyzuje |
| Dodawanie/usuwanie instruktorów, ich godzin pracy | `InstructorsSection.tsx`, `StaffForm.tsx`, `WorkingHoursForm.tsx` | Tworzy prawdziwe konto (Edge Function `create-staff`) |
| Rozpatrywanie zgłoszeń instruktorów (urlop/problem) | `InstructorRequestsSection.tsx` | Musi kliknąć "rozpatrzone" ręcznie |
| Scoring instruktorów | `InstructorScoring.tsx` | Widzi tylko admin (RLS) |
| Sale, flota, nazwa OSK | `RoomsSection.tsx`, `FleetSection.tsx`, `OskNameForm.tsx` | Dane wejściowe dla `capacity.ts` |

## Instruktor / wykładowca (pracownik)

Panel: `InstruktorPanel.tsx` → zakładki Grafik / Zgłoś do admina.

| Funkcja | Gdzie w UI | Za co odpowiada |
|---|---|---|
| Potwierdzanie obecności na jeździe (R9) | `AttendanceView.tsx` | Jedyny, kto może zamknąć slot jako "odbyty" (Edge Function `confirm-attendance`) — to jego podpis w `attendance_event` |
| Zgłoszenie do admina (urlop, problem, zmiana grafiku) | `InstructorRequestForm.tsx` | Zapisuje treść — admin decyduje co dalej |

Instruktor **nie** zarządza własnym grafikiem — godziny pracy ustawia admin (`working_hours`), instruktor tylko widzi wynikające z nich sloty.

## Kursant (klient)

Panel: `KursantPanel.tsx` → zakładki Terminarz / Nauka / Ranking / Chat.

| Funkcja | Gdzie w UI | Za co odpowiada |
|---|---|---|
| Zgłoszenie na kurs (publiczny formularz, przed zalogowaniem) | `ApplicationForm.tsx` | Deklaruje dostępność — to wejście dla auto-przydziału praktyki |
| Rezerwacja/odwołanie jazdy ręcznie | `BookingView.tsx` | Samodzielna rezerwacja poza auto-przydziałem |
| Potwierdzenie/odwołanie auto-przydzielonej propozycji jazdy | `PracticeSchedule.tsx` | **Musi zareagować** w oknie 48h, inaczej system sam przenosi slot do giełdy |
| Rezerwacja z giełdy wolnych terminów | `PracticeSchedule.tsx` | Pierwszy klik wygrywa (atomowy update w DB) |
| Postęp godzin praktyki | `HoursProgress.tsx` | Tylko odczyt — liczy silnik `hours.ts` z historii slotów |
| Symulacja egzaminu, ranking | `SimulationSection.tsx`, `RankingSection.tsx` | Własny wynik, ranking per kurs |
| Chat z adminem | `ChatSection.tsx` | — |

Kursant **nie** widzi propozycji ani giełdy z innych kursów — filtr po `course_id`.

## Brzegi odpowiedzialności (gdzie się stykają role)

- **Kto tworzy konto**: admin (kandydata przez zatwierdzenie zgłoszenia, instruktora przez `StaffForm`). Nikt nie rejestruje się sam poza publicznym formularzem zgłoszenia (który jeszcze nie jest kontem).
- **Kto liczy godziny**: silnik (`hours.ts`), nie żadna z ról ręcznie — admin i kursant tylko to widzą.
- **Kto rozstrzyga konflikt grafiku**: dziś nikt — jeśli auto-przydział źle dopasuje, jedyna naprawa to odwołanie przez kursanta (trafia do giełdy) albo ręczne działanie admina bezpośrednio w danych. **Brak UI do ręcznej korekty przez admina** — do rozważenia, jeśli auto-przydział zacznie się mylić w praktyce.

---
Skipped: brak diagramu przepływu, brak macierzy uprawnień RLS 1:1 (te żyją w migracjach `supabase/migrations/*.sql`, nie duplikuję ich tutaj). Dodać jeśli commit zacznie się rozjeżdżać z realnym RLS.
