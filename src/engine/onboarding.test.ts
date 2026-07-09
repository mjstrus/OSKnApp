import { describe, expect, it } from "vitest";
import {
  WIEK_MIN_LATA,
  WIEK_MIN_MIESIACE,
  czyNiepelnoletni,
  walidujZgloszenie,
} from "./onboarding";
import type { DaneZgloszenia } from "./onboarding";

// Bazowe, kompletne zgłoszenie pełnoletniego (referencja: start kursu 2026-07-05).
const bazowe: DaneZgloszenia = {
  imie: "Jan",
  nazwisko: "Kowalski",
  email: "jan@example.com",
  telefon: "600100200",
  kategoria: "B",
  pkkNumber: "PKK/2026/123",
  dataUrodzenia: "2000-01-01",
  zgodaRodo: true,
  zgodaOpiekuna: false,
  dataStartuKursu: "2026-07-05",
};

describe("walidujZgloszenie — kompletność (R4)", () => {
  it("kompletne zgłoszenie pełnoletniego → ok", () => {
    expect(walidujZgloszenie(bazowe)).toEqual({ ok: true });
  });

  it("brak zgody RODO → niekompletne", () => {
    const w = walidujZgloszenie({ ...bazowe, zgodaRodo: false });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.braki).toContain("zgoda RODO");
  });

  it.each([
    ["imie", { imie: "" }],
    ["nazwisko", { nazwisko: "  " }],
    ["email", { email: "" }],
    ["telefon", { telefon: "" }],
    ["pkkNumber", { pkkNumber: "" }],
    ["dataUrodzenia", { dataUrodzenia: "" }],
  ])("brak wymaganego pola %s → niekompletne", (_pole, patch) => {
    const w = walidujZgloszenie({ ...bazowe, ...(patch as Partial<DaneZgloszenia>) });
    expect(w.ok).toBe(false);
  });

  it("niepoprawny format email → niekompletne", () => {
    const w = walidujZgloszenie({ ...bazowe, email: "to-nie-email" });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.braki.join(" ")).toMatch(/email/i);
  });
});

describe("walidujZgloszenie — wiek i zgoda opiekuna (R4)", () => {
  it("niepełnoletni (17 lat) BEZ zgody opiekuna → niekompletne", () => {
    const w = walidujZgloszenie({
      ...bazowe,
      dataUrodzenia: "2009-01-01", // ~17,5 roku w dniu startu
      zgodaOpiekuna: false,
    });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.braki.join(" ")).toMatch(/opiekun/i);
  });

  it("niepełnoletni (17 lat) ZE zgodą opiekuna → ok", () => {
    const w = walidujZgloszenie({
      ...bazowe,
      dataUrodzenia: "2009-01-01",
      zgodaOpiekuna: true,
    });
    expect(w).toEqual({ ok: true });
  });

  it("za młody (poniżej 17 lat − 3 mies.) → niekompletne nawet ze zgodą opiekuna", () => {
    const w = walidujZgloszenie({
      ...bazowe,
      dataUrodzenia: "2010-01-01", // ~16,5 roku
      zgodaOpiekuna: true,
    });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.braki.join(" ")).toMatch(/młod|wiek/i);
  });

  it("granica: dokładnie 17 lat − 3 mies. w dniu startu → dopuszczony (ze zgodą opiekuna)", () => {
    // 2009-10-05 + 16 lat 9 mies. = 2026-07-05 (dzień startu)
    const w = walidujZgloszenie({
      ...bazowe,
      dataUrodzenia: "2009-10-05",
      zgodaOpiekuna: true,
    });
    expect(w).toEqual({ ok: true });
  });

  it("pełnoletni (dokładnie 18) → zgoda opiekuna zbędna", () => {
    const w = walidujZgloszenie({
      ...bazowe,
      dataUrodzenia: "2008-07-05", // kończy 18 lat w dniu startu
      zgodaOpiekuna: false,
    });
    expect(w).toEqual({ ok: true });
  });

  it("stałe progu wieku odzwierciedlają 'do 3 mies. przed 17. urodzinami'", () => {
    expect(WIEK_MIN_LATA).toBe(16);
    expect(WIEK_MIN_MIESIACE).toBe(9);
  });
});

describe("czyNiepelnoletni", () => {
  it("poniżej 18 lat → true", () => {
    expect(czyNiepelnoletni("2009-01-01", "2026-07-05")).toBe(true);
  });
  it("18 lat i więcej → false", () => {
    expect(czyNiepelnoletni("2008-07-05", "2026-07-05")).toBe(false);
  });
});
