import { describe, expect, it } from "vitest";
import {
  EGZAMIN_WORD_B,
  dobierzPytania,
  ocenPodejscie,
} from "./exam";
import type { Pytanie } from "./exam";

let seq = 0;
const pytanie = (typ: Pytanie["typ"], waga: 1 | 2 | 3, poprawna: string, kategoria = "B"): Pytanie => ({
  id: `q${seq++}`,
  kategoria,
  typ,
  waga,
  poprawna,
});

// Pula z zapasem: 25 podstawowych + 15 specjalistycznych kat. B (+ trochę kat. A).
function pula(): Pytanie[] {
  const p: Pytanie[] = [];
  for (let i = 0; i < 25; i++) p.push(pytanie("podstawowe", ((i % 3) + 1) as 1 | 2 | 3, "TAK"));
  for (let i = 0; i < 15; i++) p.push(pytanie("specjalistyczne", ((i % 3) + 1) as 1 | 2 | 3, "A"));
  for (let i = 0; i < 5; i++) p.push(pytanie("podstawowe", 3, "NIE", "A")); // inna kategoria
  return p;
}

describe("dobierzPytania — dobór wg kategorii i typu (R16)", () => {
  it("zwraca 20 podstawowych + 12 specjalistycznych (format WORD)", () => {
    const wybrane = dobierzPytania(pula(), "B");
    expect(wybrane).toHaveLength(32);
    expect(wybrane.filter((q) => q.typ === "podstawowe")).toHaveLength(20);
    expect(wybrane.filter((q) => q.typ === "specjalistyczne")).toHaveLength(12);
  });

  it("dobiera tylko pytania żądanej kategorii", () => {
    const wybrane = dobierzPytania(pula(), "B");
    expect(wybrane.every((q) => q.kategoria === "B")).toBe(true);
  });

  it("rzuca błąd, gdy w puli brakuje pytań danego typu", () => {
    const zaMalo = [pytanie("podstawowe", 1, "TAK")];
    expect(() => dobierzPytania(zaMalo, "B")).toThrow(/pyta|niewystarcz|pul/i);
  });

  it("respektuje konfigurowalny format (inne liczby)", () => {
    const wybrane = dobierzPytania(pula(), "B", {
      ...EGZAMIN_WORD_B,
      liczbaPodstawowych: 5,
      liczbaSpecjalistycznych: 3,
    });
    expect(wybrane).toHaveLength(8);
  });
});

describe("ocenPodejscie — punktacja i próg (R16)", () => {
  // Zestaw sumujący się do dokładnie 74 pkt (format WORD).
  function zestaw74(): Pytanie[] {
    const p: Pytanie[] = [];
    // podstawowe: 10×3 + 6×2 + 4×1 = 46
    for (let i = 0; i < 10; i++) p.push(pytanie("podstawowe", 3, "TAK"));
    for (let i = 0; i < 6; i++) p.push(pytanie("podstawowe", 2, "TAK"));
    for (let i = 0; i < 4; i++) p.push(pytanie("podstawowe", 1, "TAK"));
    // specjalistyczne: 6×3 + 4×2 + 2×1 = 28
    for (let i = 0; i < 6; i++) p.push(pytanie("specjalistyczne", 3, "A"));
    for (let i = 0; i < 4; i++) p.push(pytanie("specjalistyczne", 2, "A"));
    for (let i = 0; i < 2; i++) p.push(pytanie("specjalistyczne", 1, "A"));
    return p;
  }

  const wszystkiePoprawne = (p: Pytanie[]): Record<string, string> =>
    Object.fromEntries(p.map((q) => [q.id, q.poprawna]));

  it("komplet poprawnych → 74 pkt, maxPkt 74, zaliczony", () => {
    const p = zestaw74();
    const w = ocenPodejscie(p, wszystkiePoprawne(p));
    expect(w.maxPkt).toBe(74);
    expect(w.punkty).toBe(74);
    expect(w.zaliczony).toBe(true);
  });

  it("suma punktów nie przekracza maxPkt (≤74)", () => {
    const p = zestaw74();
    const w = ocenPodejscie(p, wszystkiePoprawne(p));
    expect(w.punkty).toBeLessThanOrEqual(w.maxPkt);
  });

  it("próg 68 rozstrzyga: 68 zalicza, 67 nie", () => {
    const p = zestaw74();
    const odp = wszystkiePoprawne(p);

    // Zbij wynik do 67: usuń poprawne odpowiedzi warte łącznie 7 pkt (3+3+1).
    const doZbicia = [
      p.find((q) => q.waga === 3)!,
      p.filter((q) => q.waga === 3)[1]!,
      p.find((q) => q.waga === 1)!,
    ];
    const odp67 = { ...odp };
    for (const q of doZbicia) odp67[q.id] = "ZŁA";
    const w67 = ocenPodejscie(p, odp67);
    expect(w67.punkty).toBe(67);
    expect(w67.zaliczony).toBe(false);

    // Oddaj 1 pkt z powrotem → 68 → zaliczony.
    const oddany = doZbicia[2]!;
    const odp68 = { ...odp67, [oddany.id]: oddany.poprawna };
    const w68 = ocenPodejscie(p, odp68);
    expect(w68.punkty).toBe(68);
    expect(w68.zaliczony).toBe(true);
  });

  it("brak odpowiedzi liczony jako błędny", () => {
    const p = zestaw74();
    const w = ocenPodejscie(p, {});
    expect(w.punkty).toBe(0);
    expect(w.zaliczony).toBe(false);
    expect(w.liczbaPoprawnych).toBe(0);
    expect(w.liczbaBlednych).toBe(p.length);
  });
});
