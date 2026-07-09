import { describe, expect, it } from "vitest";
import { zweryfikujPojemnoscKursu, type ZasobyOsk } from "./capacity";

const zasobyOk: ZasobyOsk = {
  sale: [{ pojemnosc: 20 }],
  liczbaAktywnychAut: 3,
  liczbaInstruktorowPraktyki: 3,
  godzinyInstruktorowPraktykiTygodniowo: 60, // 3 instr. x 20h/tydz.
  godzinyWykladowcowTygodniowo: 20,
};

describe("zweryfikujPojemnoscKursu", () => {
  it("zwraca ok, gdy zasoby pokrywają zapotrzebowanie", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 15, docelowyCzasDni: 90 },
      zasobyOk,
    );
    expect(wynik.ok).toBe(true);
    expect(wynik.problemy).toEqual([]);
  });

  it("zgłasza brak sal, gdy nie ma żadnej sali", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 15, docelowyCzasDni: 45 },
      { ...zasobyOk, sale: [] },
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy[0]).toMatch(/brak zdefiniowanych sal/i);
  });

  it("zgłasza za małą salę względem max_uczestnicy", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 25, docelowyCzasDni: 45 },
      { ...zasobyOk, sale: [{ pojemnosc: 20 }] },
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy.some((p) => /nie pomieści 25/.test(p))).toBe(true);
  });

  it("zgłasza za mało godzin wykładowców w krótkim terminie", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 100, hPraktyka: 30, maxUczestnicy: 15, docelowyCzasDni: 14 },
      zasobyOk,
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy.some((p) => /godzin wykładowców/.test(p))).toBe(true);
  });

  it("zgłasza za mało godzin instruktorów praktyki", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 30, docelowyCzasDni: 14 },
      zasobyOk,
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy.some((p) => /mocy na jazdy/.test(p))).toBe(true);
  });

  it("auta jako wąskie gardło: mniej aut niż instruktorów obniża efektywną moc", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 15, docelowyCzasDni: 45 },
      { ...zasobyOk, liczbaAktywnychAut: 1 }, // 1 auto / 3 instruktorów -> 1/3 mocy
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy.some((p) => /auta są wąskim gardłem/.test(p))).toBe(true);
  });

  it("zgłasza brak instruktorów praktyki", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 15, docelowyCzasDni: 45 },
      { ...zasobyOk, liczbaInstruktorowPraktyki: 0 },
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy).toContain("Brak instruktorów praktyki.");
  });

  it("zgłasza brak aktywnych aut", () => {
    const wynik = zweryfikujPojemnoscKursu(
      { hTeoria: 30, hPraktyka: 30, maxUczestnicy: 15, docelowyCzasDni: 45 },
      { ...zasobyOk, liczbaAktywnychAut: 0 },
    );
    expect(wynik.ok).toBe(false);
    expect(wynik.problemy).toContain("Brak aktywnych aut w flocie.");
  });
});
