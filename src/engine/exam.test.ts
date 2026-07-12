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

// Pula z zapasem per warstwa wagowa: kat. B ma >=15 pytań każdej wagi każdego
// typu (WORD potrzebuje max 10), plus trochę kat. A żeby sprawdzić filtrowanie.
function pula(): Pytanie[] {
  const p: Pytanie[] = [];
  for (const waga of [1, 2, 3] as const) {
    for (let i = 0; i < 15; i++) p.push(pytanie("podstawowe", waga, "TAK"));
    for (let i = 0; i < 15; i++) p.push(pytanie("specjalistyczne", waga, "A"));
  }
  for (let i = 0; i < 5; i++) p.push(pytanie("podstawowe", 3, "NIE", "A")); // inna kategoria
  return p;
}

describe("dobierzPytania — dobór wg kategorii i warstw wagowych (R16)", () => {
  it("zwraca 20 podstawowych + 12 specjalistycznych z max 74 pkt (format WORD)", () => {
    const wybrane = dobierzPytania(pula(), "B");
    expect(wybrane).toHaveLength(32);
    expect(wybrane.filter((q) => q.typ === "podstawowe")).toHaveLength(20);
    expect(wybrane.filter((q) => q.typ === "specjalistyczne")).toHaveLength(12);
    expect(wybrane.reduce((s, q) => s + q.waga, 0)).toBe(74);
  });

  it("dobiera tylko pytania żądanej kategorii", () => {
    const wybrane = dobierzPytania(pula(), "B");
    expect(wybrane.every((q) => q.kategoria === "B")).toBe(true);
  });

  it("rzuca błąd, gdy w puli brakuje pytań danej wagi", () => {
    const zaMalo = [pytanie("podstawowe", 1, "TAK")];
    expect(() => dobierzPytania(zaMalo, "B")).toThrow(/pyta|niewystarcz|pul|waz/i);
  });

  it("respektuje konfigurowalny format (inne warstwy)", () => {
    const wybrane = dobierzPytania(pula(), "B", {
      ...EGZAMIN_WORD_B,
      podstawowe: [{ waga: 3, liczba: 2 }, { waga: 1, liczba: 3 }],
      specjalistyczne: [{ waga: 2, liczba: 3 }],
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
