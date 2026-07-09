import { describe, expect, it } from "vitest";
import {
  DLUGOSC_SLOTU_PRAKTYKI_MIN,
  czyKoliduje,
  dostepneSlotyPraktyki,
  generujBlokiTeorii,
  odejmij,
  potnijNaSloty,
  przetnij,
  rozwinGodzinyTygodniowe,
  scal,
  walidujRezerwacje,
  wolneOknaInstruktora,
  zawieraSie,
} from "./scheduling";
import type { Interwal } from "./scheduling";

// Skróty: praca na minutach od umownego zera; h(1) = 60 min.
const h = (n: number): number => n * 60;
const iw = (odH: number, doH: number): Interwal => ({ start: h(odH), end: h(doH) });

describe("scal — normalizacja i łączenie interwałów", () => {
  it("sortuje i łączy nachodzące oraz stykające się", () => {
    expect(scal([iw(2, 3), iw(0, 1), iw(1, 2), iw(2.5, 4)])).toEqual([iw(0, 4)]);
  });
  it("zostawia rozłączne osobno", () => {
    expect(scal([iw(0, 1), iw(2, 3)])).toEqual([iw(0, 1), iw(2, 3)]);
  });
  it("pusta lista → pusta", () => {
    expect(scal([])).toEqual([]);
  });
});

describe("odejmij — różnica interwałów", () => {
  it("wycina zajęty fragment ze środka okna", () => {
    expect(odejmij([iw(8, 16)], [iw(10, 11)])).toEqual([iw(8, 10), iw(11, 16)]);
  });
  it("zajęte na krawędzi przycina bez pustych fragmentów", () => {
    expect(odejmij([iw(8, 16)], [iw(8, 9)])).toEqual([iw(9, 16)]);
  });
  it("zajęte pokrywające całe okno usuwa je", () => {
    expect(odejmij([iw(8, 16)], [iw(7, 17)])).toEqual([]);
  });
  it("brak zajętych zwraca okno bez zmian (znormalizowane)", () => {
    expect(odejmij([iw(8, 16)], [])).toEqual([iw(8, 16)]);
  });
});

describe("przetnij — część wspólna dwóch list", () => {
  it("zwraca nakładające się fragmenty", () => {
    expect(przetnij([iw(8, 16)], [iw(10, 20)])).toEqual([iw(10, 16)]);
  });
  it("rozłączne → brak części wspólnej", () => {
    expect(przetnij([iw(8, 10)], [iw(12, 14)])).toEqual([]);
  });
  it("wiele okien po obu stronach", () => {
    expect(przetnij([iw(8, 12), iw(14, 18)], [iw(10, 15), iw(16, 20)])).toEqual([
      iw(10, 12),
      iw(14, 15),
      iw(16, 18),
    ]);
  });
});

describe("potnijNaSloty — cięcie na jednostki stałej długości", () => {
  it("tnie okno na sloty 1 h, resztę krótszą niż slot odrzuca", () => {
    expect(potnijNaSloty([{ start: 0, end: 150 }], 60)).toEqual([
      { start: 0, end: 60 },
      { start: 60, end: 120 },
    ]);
  });
  it("okno krótsze niż slot → brak slotów", () => {
    expect(potnijNaSloty([{ start: 0, end: 40 }], 60)).toEqual([]);
  });
});

describe("wolneOknaInstruktora = godziny pracy − zajęte sloty (R7)", () => {
  it("odejmuje zajęte sloty od okien pracy", () => {
    const okna = [iw(8, 16)];
    const zajete = [iw(9, 10), iw(13, 14)];
    expect(wolneOknaInstruktora(okna, zajete)).toEqual([iw(8, 9), iw(10, 13), iw(14, 16)]);
  });
});

describe("dostepneSlotyPraktyki — przecięcie okien pocięte na sloty 1 h (R7)", () => {
  it("część wspólna dostępności instruktora i kursanta, sloty 1 h", () => {
    const wolneInstruktora = [iw(8, 12)];
    const dostepnoscKursanta = [iw(9, 11)];
    expect(dostepneSlotyPraktyki(wolneInstruktora, dostepnoscKursanta)).toEqual([
      iw(9, 10),
      iw(10, 11),
    ]);
  });
  it("brak wspólnego okna → brak slotów", () => {
    expect(dostepneSlotyPraktyki([iw(8, 10)], [iw(12, 14)])).toEqual([]);
  });
  it("slot domyślny to 1 h (60 min)", () => {
    expect(DLUGOSC_SLOTU_PRAKTYKI_MIN).toBe(60);
  });
});

describe("zawieraSie / czyKoliduje", () => {
  it("zawieraSie: slot w pełni w oknie", () => {
    expect(zawieraSie(iw(9, 10), [iw(8, 16)])).toBe(true);
    expect(zawieraSie(iw(15, 17), [iw(8, 16)])).toBe(false);
  });
  it("czyKoliduje: nakładanie tak, styk nie", () => {
    expect(czyKoliduje(iw(9, 10), [iw(9, 10)])).toBe(true);
    expect(czyKoliduje(iw(9, 10), [iw(8, 9)])).toBe(false); // styk krawędzią
    expect(czyKoliduje(iw(9, 11), [iw(10, 12)])).toBe(true);
    expect(czyKoliduje(iw(9, 10), [])).toBe(false);
  });
});

describe("walidujRezerwacje (R7, R10, R14b)", () => {
  const bazowe = {
    slot: iw(9, 10),
    wolneOknaInstruktora: [iw(8, 16)],
    dostepnoscKursanta: [iw(8, 12)],
    slotyInstruktora: [] as Interwal[],
    slotyKursanta: [] as Interwal[],
    clearedToDrive: true,
  };

  it("poprawna rezerwacja → ok", () => {
    expect(walidujRezerwacje(bazowe)).toEqual({ ok: true });
  });

  it("brak flagi cleared_to_drive → odrzucona (R14b)", () => {
    const w = walidujRezerwacje({ ...bazowe, clearedToDrive: false });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.powod).toMatch(/dopuszcz/i);
  });

  it("slot poza oknem instruktora → odrzucona", () => {
    const w = walidujRezerwacje({ ...bazowe, slot: iw(17, 18) });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.powod).toMatch(/instruktor/i);
  });

  it("slot poza dostępnością kursanta → odrzucona", () => {
    const w = walidujRezerwacje({ ...bazowe, slot: iw(13, 14) });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.powod).toMatch(/kursant/i);
  });

  it("kolizja ze slotem instruktora → odrzucona", () => {
    const w = walidujRezerwacje({ ...bazowe, slotyInstruktora: [iw(9, 10)] });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.powod).toMatch(/instruktor/i);
  });

  it("kolizja z innym slotem kursanta → odrzucona", () => {
    const w = walidujRezerwacje({ ...bazowe, slotyKursanta: [iw(9, 10)] });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.powod).toMatch(/kursant/i);
  });

  it("slot niebędący dokładnie 1 h → odrzucony", () => {
    const w = walidujRezerwacje({ ...bazowe, slot: iw(9, 11) });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.powod).toMatch(/1 h|długość|dlugo/i);
  });

  // Scenariusz z planu: dwóch kursantów, ten sam slot tego samego instruktora.
  it("drugi kursant nie zarezerwuje slotu zajętego u instruktora", () => {
    const pierwszy = walidujRezerwacje(bazowe);
    expect(pierwszy).toEqual({ ok: true });
    // po rezerwacji pierwszego slot trafia do slotyInstruktora
    const drugi = walidujRezerwacje({
      ...bazowe,
      slotyInstruktora: [iw(9, 10)],
      slotyKursanta: [],
    });
    expect(drugi.ok).toBe(false);
  });
});

describe("generujBlokiTeorii — auto-harmonogram grupowy (R6)", () => {
  it("pokrywa dokładnie h_teoria godzin lekcyjnych (45 min) w oknach wykładowcy", () => {
    // okno 08:00–16:00 = 480 min = 10 godzin lekcyjnych po 45 min
    const bloki = generujBlokiTeorii([iw(8, 16)], 6);
    const suma = bloki.reduce((s, b) => s + b.liczbaGodzin, 0);
    expect(suma).toBe(6);
    // wszystkie bloki mieszczą się w oknie i się nie nakładają
    for (const b of bloki) {
      expect(b.start).toBeGreaterThanOrEqual(h(8));
      expect(b.end).toBeLessThanOrEqual(h(16));
      expect(b.end - b.start).toBe(b.liczbaGodzin * 45);
    }
  });

  it("rozkłada godziny na wiele okien, gdy jedno nie wystarcza", () => {
    // dwa krótkie okna po 90 min = 2 godziny lekcyjne każde
    const bloki = generujBlokiTeorii([iw(8, 9.5), iw(12, 13.5)], 4);
    expect(bloki.reduce((s, b) => s + b.liczbaGodzin, 0)).toBe(4);
    expect(bloki.length).toBe(2);
  });

  it("rzuca błąd, gdy okna wykładowcy nie mieszczą wymaganych godzin", () => {
    expect(() => generujBlokiTeorii([iw(8, 9)], 10)).toThrow(/wykładowc|okien|niewystarcz/i);
  });

  it("h_teoria = 0 → brak bloków", () => {
    expect(generujBlokiTeorii([iw(8, 16)], 0)).toEqual([]);
  });
});

describe("rozwinGodzinyTygodniowe", () => {
  const PONIEDZIALEK = 0; // umowny epoch-minuty 00:00 poniedziałku

  it("rozwija jeden dzień na jednym tygodniu", () => {
    const wynik = rozwinGodzinyTygodniowe(
      [{ dzienTygodnia: 0, odMin: h(8), doMin: h(16) }],
      PONIEDZIALEK,
      1,
    );
    expect(wynik).toEqual([{ start: h(8), end: h(16) }]);
  });

  it("rozwija na wielu tygodniach — poprawny offset dnia tygodnia", () => {
    const wynik = rozwinGodzinyTygodniowe(
      [{ dzienTygodnia: 2, odMin: h(8), doMin: h(12) }], // środa
      PONIEDZIALEK,
      2,
    );
    const dzienMin = 24 * 60;
    expect(wynik).toEqual([
      { start: 2 * dzienMin + h(8), end: 2 * dzienMin + h(12) },
      { start: 7 * dzienMin + 2 * dzienMin + h(8), end: 7 * dzienMin + 2 * dzienMin + h(12) },
    ]);
  });

  it("wiele dni w tygodniu — kolejność zachowana wg wejścia", () => {
    const wynik = rozwinGodzinyTygodniowe(
      [
        { dzienTygodnia: 0, odMin: h(8), doMin: h(12) },
        { dzienTygodnia: 3, odMin: h(16), doMin: h(20) },
      ],
      PONIEDZIALEK,
      1,
    );
    expect(wynik).toHaveLength(2);
    expect(wynik[1]!.start).toBe(3 * 24 * 60 + h(16));
  });

  it("horyzont 0 tygodni → brak interwałów", () => {
    expect(rozwinGodzinyTygodniowe([{ dzienTygodnia: 0, odMin: h(8), doMin: h(16) }], PONIEDZIALEK, 0)).toEqual([]);
  });
});
