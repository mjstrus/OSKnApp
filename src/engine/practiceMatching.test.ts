import { describe, expect, it } from "vitest";
import { dopasujGrafikPraktyki } from "./practiceMatching";

const h = (n: number): number => n * 60;

describe("dopasujGrafikPraktyki", () => {
  it("przydziela pełną liczbę godzin, gdy dostępność pokrywa okna instruktora", () => {
    const wynik = dopasujGrafikPraktyki(
      [{ enrollmentId: "k1", potrzebneGodziny: 3, dostepnosc: [{ start: h(8), end: h(20) }] }],
      [{ instructorId: "i1", wolneOkna: [{ start: h(8), end: h(16) }] }],
    );
    expect(wynik.przydzielone).toHaveLength(3);
    expect(wynik.niedoprzydzieleni).toEqual([]);
    // Kolejne sloty nie nakładają się.
    const starty = wynik.przydzielone.map((p) => p.start).sort((a, b) => a - b);
    expect(new Set(starty).size).toBe(3);
  });

  it("zgłasza brakujące godziny, gdy dostępność nie pokrywa wystarczająco okien", () => {
    const wynik = dopasujGrafikPraktyki(
      [{ enrollmentId: "k1", potrzebneGodziny: 5, dostepnosc: [{ start: h(8), end: h(10) }] }],
      [{ instructorId: "i1", wolneOkna: [{ start: h(8), end: h(16) }] }],
    );
    expect(wynik.przydzielone).toHaveLength(2);
    expect(wynik.niedoprzydzieleni).toEqual([{ enrollmentId: "k1", brakujeGodzin: 3 }]);
  });

  it("dwóch kursantów rywalizujących o ten sam slot — drugi dostaje kolejny wolny", () => {
    const wynik = dopasujGrafikPraktyki(
      [
        { enrollmentId: "k1", potrzebneGodziny: 1, dostepnosc: [{ start: h(8), end: h(10) }] },
        { enrollmentId: "k2", potrzebneGodziny: 1, dostepnosc: [{ start: h(8), end: h(10) }] },
      ],
      [{ instructorId: "i1", wolneOkna: [{ start: h(8), end: h(10) }] }],
    );
    expect(wynik.przydzielone).toHaveLength(2);
    expect(wynik.niedoprzydzieleni).toEqual([]);
    const [a, b] = wynik.przydzielone;
    expect(a!.start).not.toBe(b!.start);
  });

  it("rozkłada kursantów między instruktorami (round-robin)", () => {
    const wynik = dopasujGrafikPraktyki(
      [
        { enrollmentId: "k1", potrzebneGodziny: 1, dostepnosc: [{ start: h(8), end: h(20) }] },
        { enrollmentId: "k2", potrzebneGodziny: 1, dostepnosc: [{ start: h(8), end: h(20) }] },
      ],
      [
        { instructorId: "iA", wolneOkna: [{ start: h(8), end: h(9) }] },
        { instructorId: "iB", wolneOkna: [{ start: h(8), end: h(9) }] },
      ],
    );
    expect(wynik.przydzielone).toHaveLength(2);
    const instruktorzyUzyci = new Set(wynik.przydzielone.map((p) => p.instructorId));
    expect(instruktorzyUzyci.size).toBe(2);
  });

  it("brak instruktorów → wszyscy niedoprzydzieleni", () => {
    const wynik = dopasujGrafikPraktyki(
      [{ enrollmentId: "k1", potrzebneGodziny: 2, dostepnosc: [{ start: h(8), end: h(20) }] }],
      [],
    );
    expect(wynik.przydzielone).toEqual([]);
    expect(wynik.niedoprzydzieleni).toEqual([{ enrollmentId: "k1", brakujeGodzin: 2 }]);
  });

  it("potrzebneGodziny = 0 → pomija kursanta bez zgłaszania braku", () => {
    const wynik = dopasujGrafikPraktyki(
      [{ enrollmentId: "k1", potrzebneGodziny: 0, dostepnosc: [] }],
      [{ instructorId: "i1", wolneOkna: [{ start: h(8), end: h(16) }] }],
    );
    expect(wynik.przydzielone).toEqual([]);
    expect(wynik.niedoprzydzieleni).toEqual([]);
  });
});
