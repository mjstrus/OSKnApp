import { describe, expect, it } from "vitest";
import {
  czyDopuszczonyDoEgzaminu,
  ileDokupic,
  stanPoczatkowy,
  zastosujRozliczenie,
  zastosujSekwencje,
} from "./hours";
import type { StanKursanta, TypRozliczenia } from "./types";

// Pomocnik: n powtórzeń tego samego typu rozliczenia.
const powtorz = (typ: TypRozliczenia, n: number): TypRozliczenia[] =>
  Array.from({ length: n }, () => typ);

describe("stanPoczatkowy", () => {
  it("startuje z pełną pulą opłaconych = h praktyki, zerowymi licznikami", () => {
    expect(stanPoczatkowy(30)).toEqual<StanKursanta>({
      potwierdzone: 0,
      oplaconePozostale: 30,
      nieusprawiedliwione: 0,
      dokupione: 0,
      cel: 30,
    });
  });

  it("domyślnie celuje w 30 h (kat. B)", () => {
    expect(stanPoczatkowy().cel).toBe(30);
    expect(stanPoczatkowy().oplaconePozostale).toBe(30);
  });

  it("respektuje inny profil godzinowy kursu (elastyczny cel)", () => {
    const stan = stanPoczatkowy(20);
    expect(stan.cel).toBe(20);
    expect(stan.oplaconePozostale).toBe(20);
  });
});

describe("zastosujRozliczenie — pojedyncze przejścia (R12)", () => {
  it("odbyta: +1 potwierdzone, -1 pula", () => {
    const po = zastosujRozliczenie(stanPoczatkowy(30), "odbyta");
    expect(po.potwierdzone).toBe(1);
    expect(po.oplaconePozostale).toBe(29);
  });

  it("odbyta rzuca błąd, gdy pula opłaconych jest pusta (wymaga dokupu — R14)", () => {
    const pustaPula: StanKursanta = { ...stanPoczatkowy(30), oplaconePozostale: 0 };
    expect(() => zastosujRozliczenie(pustaPula, "odbyta")).toThrow(/pul/i);
  });

  it("odwolana_w_oknie: bez zmian liczników (slot wraca do puli)", () => {
    const przed = stanPoczatkowy(30);
    expect(zastosujRozliczenie(przed, "odwolana_w_oknie")).toEqual(przed);
  });

  it("usprawiedliwiona: bez zmian liczników (opłacona godzina nie przepada)", () => {
    const przed = stanPoczatkowy(30);
    expect(zastosujRozliczenie(przed, "usprawiedliwiona")).toEqual(przed);
  });

  it("nieusprawiedliwiona #1: darmowe przełożenie — pula nietknięta", () => {
    const po = zastosujRozliczenie(stanPoczatkowy(30), "nieusprawiedliwiona");
    expect(po.nieusprawiedliwione).toBe(1);
    expect(po.oplaconePozostale).toBe(30);
    expect(po.potwierdzone).toBe(0);
  });

  it("nieusprawiedliwiona #2: opłacona godzina przepada, potwierdzone bez zmian", () => {
    const po1 = zastosujRozliczenie(stanPoczatkowy(30), "nieusprawiedliwiona");
    const po2 = zastosujRozliczenie(po1, "nieusprawiedliwiona");
    expect(po2.nieusprawiedliwione).toBe(2);
    expect(po2.oplaconePozostale).toBe(29);
    expect(po2.potwierdzone).toBe(0);
  });

  it("dokup: +1 dokupione, +1 pula; potwierdzone bez zmian (liczy się po potwierdzeniu)", () => {
    const po = zastosujRozliczenie(stanPoczatkowy(30), "dokup");
    expect(po.dokupione).toBe(1);
    expect(po.oplaconePozostale).toBe(31);
    expect(po.potwierdzone).toBe(0);
  });

  it("nie mutuje wejściowego stanu (czysta funkcja)", () => {
    const przed = stanPoczatkowy(30);
    const snapshot = { ...przed };
    zastosujRozliczenie(przed, "odbyta");
    expect(przed).toEqual(snapshot);
  });
});

describe("czyDopuszczonyDoEgzaminu (R13: potwierdzone ≥ cel)", () => {
  it("29 potwierdzonych → niedopuszczony", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), potwierdzone: 29 };
    expect(czyDopuszczonyDoEgzaminu(stan)).toBe(false);
  });

  it("dokładnie 30 potwierdzonych → dopuszczony", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), potwierdzone: 30 };
    expect(czyDopuszczonyDoEgzaminu(stan)).toBe(true);
  });
});

describe("ileDokupic = max(0, cel − (potwierdzone + pula))", () => {
  it("pełna pula wystarcza do celu → 0", () => {
    expect(ileDokupic(stanPoczatkowy(30))).toBe(0);
  });

  it("pula uszczuplona przez przepadek → brakującą godzinę trzeba dokupić", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), oplaconePozostale: 29 };
    expect(ileDokupic(stan)).toBe(1);
  });

  it("nie zwraca wartości ujemnej, gdy zasobów jest nadmiar", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), potwierdzone: 30, oplaconePozostale: 5 };
    expect(ileDokupic(stan)).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// Scenariusze end-to-end z planu (Unit 2 → "Scenariusze testowe")
// ----------------------------------------------------------------------------
describe("scenariusze z planu", () => {
  it("30 odbytych → dopuszczony, dokup = 0", () => {
    const stan = zastosujSekwencje(stanPoczatkowy(30), powtorz("odbyta", 30));
    expect(stan.potwierdzone).toBe(30);
    expect(stan.oplaconePozostale).toBe(0);
    expect(czyDopuszczonyDoEgzaminu(stan)).toBe(true);
    expect(ileDokupic(stan)).toBe(0);
  });

  it("1 nieusprawiedliwione → pula nietknięta, dopuszczony po 30 odbytych, dokup = 0", () => {
    const stan = zastosujSekwencje(stanPoczatkowy(30), [
      "nieusprawiedliwiona",
      ...powtorz("odbyta", 30),
    ]);
    expect(stan.potwierdzone).toBe(30);
    expect(stan.nieusprawiedliwione).toBe(1);
    expect(czyDopuszczonyDoEgzaminu(stan)).toBe(true);
    expect(ileDokupic(stan)).toBe(0);
  });

  it("2 nieusprawiedliwione → 1 h przepada, wymaga dokupu 1 h", () => {
    const stan = zastosujSekwencje(stanPoczatkowy(30), powtorz("nieusprawiedliwiona", 2));
    expect(stan.oplaconePozostale).toBe(29);
    expect(ileDokupic(stan)).toBe(1);
  });

  it("odwołanie w oknie i usprawiedliwione nie ruszają puli", () => {
    const stan = zastosujSekwencje(stanPoczatkowy(30), [
      "odwolana_w_oknie",
      "usprawiedliwiona",
      "odwolana_w_oknie",
    ]);
    expect(stan.oplaconePozostale).toBe(30);
    expect(stan.potwierdzone).toBe(0);
    expect(stan.nieusprawiedliwione).toBe(0);
  });

  it("dokupiona godzina liczy się dopiero po potwierdzeniu", () => {
    // Po przepadku brakuje 1 h do celu.
    const poPrzepadku = zastosujSekwencje(stanPoczatkowy(30), [
      ...powtorz("nieusprawiedliwiona", 2),
      ...powtorz("odbyta", 29),
    ]);
    expect(poPrzepadku.potwierdzone).toBe(29);
    expect(poPrzepadku.oplaconePozostale).toBe(0);
    expect(czyDopuszczonyDoEgzaminu(poPrzepadku)).toBe(false);
    expect(ileDokupic(poPrzepadku)).toBe(1);

    // Dokup zasila pulę, ale nie zalicza godziny.
    const poDokupie = zastosujRozliczenie(poPrzepadku, "dokup");
    expect(poDokupie.oplaconePozostale).toBe(1);
    expect(poDokupie.potwierdzone).toBe(29);
    expect(czyDopuszczonyDoEgzaminu(poDokupie)).toBe(false);

    // Dopiero potwierdzenie dokupionej godziny dopuszcza do egzaminu.
    const poPotwierdzeniu = zastosujRozliczenie(poDokupie, "odbyta");
    expect(poPotwierdzeniu.potwierdzone).toBe(30);
    expect(poPotwierdzeniu.oplaconePozostale).toBe(0);
    expect(czyDopuszczonyDoEgzaminu(poPotwierdzeniu)).toBe(true);
    expect(ileDokupic(poPotwierdzeniu)).toBe(0);
  });
});
