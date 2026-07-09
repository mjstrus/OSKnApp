// ============================================================================
// Unit 2 — typy współdzielone silnika godzin/odwołań (R11–R14a)
//
// Czysty TypeScript, bez zależności od DB/UI. Ten sam moduł reużywany
// w Edge Functions (Deno) jako jedno źródło prawdy dla liczników.
// ============================================================================

/** Domyślny cel godzin praktyki dla kat. B (R11). Nadpisywalny per kurs. */
export const CEL_GODZIN_DOMYSLNY = 30;

/**
 * Tolerancja nieusprawiedliwionych nieobecności na kurs (R11): pierwsza jest
 * darmowym przełożeniem, druga i kolejne kasują opłaconą godzinę z puli.
 */
export const TOLERANCJA_NIEUSPRAWIEDLIWIONYCH = 1;

/**
 * Sposób rozliczenia pojedynczego slotu praktyki — wejście automatu stanów
 * (R12). Odpowiada przejściom z diagramu stanów slotu w planie.
 */
export type TypRozliczenia =
  | "odbyta" // instruktor potwierdza obecność
  | "odwolana_w_oknie" // odwołanie w oknie bez konsekwencji
  | "usprawiedliwiona" // nieobecność usprawiedliwiona (np. choroba)
  | "nieusprawiedliwiona" // brak stawienia / za późno
  | "dokup"; // dokupiona i opłacona godzina zasila pulę

/**
 * Liczniki godzin per kursant (R11). Niemutowalny — każde rozliczenie zwraca
 * nowy stan.
 *
 * - `potwierdzone`      — odbyte i potwierdzone godziny (cel: `cel`).
 * - `oplaconePozostale` — pula opłaconych, jeszcze niewykorzystanych godzin
 *                         (start: h praktyki w cenie kursu). Maleje przy
 *                         potwierdzeniu i przy przepadku (2.+ nieusprawiedliwiona).
 * - `nieusprawiedliwione` — łączna liczba nieusprawiedliwionych (do tolerancji).
 * - `dokupione`         — kumulatywna liczba dokupionych godzin.
 * - `cel`               — próg dopuszczenia do egzaminu wewnętrznego (zwykle 30).
 */
export interface StanKursanta {
  readonly potwierdzone: number;
  readonly oplaconePozostale: number;
  readonly nieusprawiedliwione: number;
  readonly dokupione: number;
  readonly cel: number;
}
