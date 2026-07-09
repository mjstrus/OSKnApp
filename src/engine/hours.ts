// ============================================================================
// Unit 2 — silnik godzin / odwołań / obecności (R11–R14a)
//
// Czyste funkcje: jedno źródło prawdy dla liczników i automatu stanów slotu.
// Reużywalne w Edge Functions (Deno) i w UI (podgląd). DB pełni rolę
// guardraila (constraints/RLS), a nie miejsca logiki biznesowej.
// ============================================================================

import {
  CEL_GODZIN_DOMYSLNY,
  TOLERANCJA_NIEUSPRAWIEDLIWIONYCH,
  type StanKursanta,
  type TypRozliczenia,
} from "./types";

/**
 * Stan początkowy kursanta: pula opłaconych = liczba godzin praktyki w cenie
 * kursu, zerowe liczniki. `cel` domyślnie 30 h (kat. B), ale bierze się z
 * profilu kursu, więc metryka jest elastyczna.
 */
export function stanPoczatkowy(hPraktyka: number = CEL_GODZIN_DOMYSLNY): StanKursanta {
  return {
    potwierdzone: 0,
    oplaconePozostale: hPraktyka,
    nieusprawiedliwione: 0,
    dokupione: 0,
    cel: hPraktyka,
  };
}

/**
 * Stosuje pojedyncze rozliczenie slotu i zwraca NOWY stan (bez mutacji).
 * Przejścia wg diagramu stanów slotu praktycznego (R12).
 *
 * @throws Error gdy `odbyta` trafia na pustą pulę opłaconych — potwierdzenie
 *         godziny bez pokrycia jest niedozwolone (R14: najpierw dokup).
 */
export function zastosujRozliczenie(stan: StanKursanta, typ: TypRozliczenia): StanKursanta {
  switch (typ) {
    case "odbyta": {
      if (stan.oplaconePozostale <= 0) {
        throw new Error(
          "Nie można potwierdzić godziny: pula opłaconych jest pusta — wymagany dokup (R14).",
        );
      }
      return {
        ...stan,
        potwierdzone: stan.potwierdzone + 1,
        oplaconePozostale: stan.oplaconePozostale - 1,
      };
    }

    // Odwołanie w oknie i usprawiedliwiona nieobecność zwalniają slot z powrotem
    // do puli — w modelu liczników (pula maleje dopiero przy potwierdzeniu) nie
    // zmieniają żadnego licznika.
    case "odwolana_w_oknie":
    case "usprawiedliwiona":
      return { ...stan };

    case "nieusprawiedliwiona": {
      const wRamachTolerancji = stan.nieusprawiedliwione < TOLERANCJA_NIEUSPRAWIEDLIWIONYCH;
      return {
        ...stan,
        nieusprawiedliwione: stan.nieusprawiedliwione + 1,
        // Pierwsza nieusprawiedliwiona = darmowe przełożenie (pula nietknięta);
        // druga i kolejne kasują opłaconą godzinę (nie schodząc poniżej zera).
        oplaconePozostale: wRamachTolerancji
          ? stan.oplaconePozostale
          : Math.max(0, stan.oplaconePozostale - 1),
      };
    }

    case "dokup":
      // Dokupiona (i opłacona) godzina zasila pulę; do celu liczy się dopiero
      // po jej potwierdzeniu (R14).
      return {
        ...stan,
        dokupione: stan.dokupione + 1,
        oplaconePozostale: stan.oplaconePozostale + 1,
      };

    default: {
      const _exhaustive: never = typ;
      throw new Error(`Nieznany typ rozliczenia: ${String(_exhaustive)}`);
    }
  }
}

/** Składa sekwencję rozliczeń na stanie początkowym (fold). */
export function zastosujSekwencje(
  stan: StanKursanta,
  typy: readonly TypRozliczenia[],
): StanKursanta {
  return typy.reduce(zastosujRozliczenie, stan);
}

/** Bramka dopuszczenia do egzaminu wewnętrznego (R13). */
export function czyDopuszczonyDoEgzaminu(stan: StanKursanta): boolean {
  return stan.potwierdzone >= stan.cel;
}

/**
 * Ile godzin trzeba jeszcze dokupić, by osiągalny był cel (R14):
 * max(0, cel − (potwierdzone + rezerwowalne_z_puli)).
 */
export function ileDokupic(stan: StanKursanta): number {
  return Math.max(0, stan.cel - (stan.potwierdzone + stan.oplaconePozostale));
}
