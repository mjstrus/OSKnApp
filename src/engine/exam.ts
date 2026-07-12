// ============================================================================
// Unit 5 — silnik egzaminu/symulacji WORD (R16)
//
// Czysta logika doboru pytań i punktacji. Format i progi trzymamy w konfiguracji
// (nie zaszywamy na sztywno) — baza pytań jest w reformie, więc model musi być
// elastyczny. Domyślny profil: egzamin teoretyczny kat. B.
// ============================================================================

export type TypPytania = "podstawowe" | "specjalistyczne";
export type Waga = 1 | 2 | 3;

export interface Pytanie {
  id: string;
  kategoria: string;
  typ: TypPytania;
  waga: Waga;
  /** Poprawna odpowiedź jako tekst: podstawowe "TAK"/"NIE", specjalistyczne "A"/"B"/"C". */
  poprawna: string;
}

/** Warstwa doboru: ile pytań danej wagi wchodzi w skład egzaminu. */
export interface WarstwaWagowa {
  waga: Waga;
  liczba: number;
}

export interface KonfiguracjaEgzaminu {
  podstawowe: WarstwaWagowa[];
  specjalistyczne: WarstwaWagowa[];
  progZaliczenia: number;
  maxPkt: number;
  czasSekundy: number;
}

/**
 * Domyślny format egzaminu teoretycznego kat. B (WORD): 32 pytania, 25 min, 68/74.
 * Realna struktura wg rozporządzenia MI (Dz.U.2023.2659, zał. 1) — max 74 pkt
 * jest STAŁY tylko jeśli losowanie respektuje warstwy wagowe (10×3+6×2+4×1
 * podstawowe, 6×3+4×2+2×1 specjalistyczne); losowanie "N dowolnych pytań danego
 * typu" (poprzednia wersja) dawało zmienny, czasem nieosiągalny max.
 */
export const EGZAMIN_WORD_B: KonfiguracjaEgzaminu = {
  podstawowe: [
    { waga: 3, liczba: 10 },
    { waga: 2, liczba: 6 },
    { waga: 1, liczba: 4 },
  ],
  specjalistyczne: [
    { waga: 3, liczba: 6 },
    { waga: 2, liczba: 4 },
    { waga: 1, liczba: 2 },
  ],
  progZaliczenia: 68,
  maxPkt: 74,
  czasSekundy: 25 * 60,
};

export interface WynikPodejscia {
  punkty: number;
  maxPkt: number;
  zaliczony: boolean;
  liczbaPoprawnych: number;
  liczbaBlednych: number;
}

// Fisher-Yates z wstrzykiwalnym RNG (determinizm w testach).
function potasuj<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Losuje `liczba` pytań o dokładnie tej wadze z puli — rzuca, gdy pula za mała. */
function dobierzWarstwe(
  pula: readonly Pytanie[],
  { waga, liczba }: WarstwaWagowa,
  etykietaTypu: string,
  rng: () => number,
): Pytanie[] {
  const wTejWadze = pula.filter((q) => q.waga === waga);
  if (wTejWadze.length < liczba) {
    throw new Error(
      `Za mało pytań ${etykietaTypu} o wadze ${waga}: jest ${wTejWadze.length}, wymagane ${liczba}.`,
    );
  }
  return potasuj(wTejWadze, rng).slice(0, liczba);
}

/**
 * Dobiera pytania do symulacji wg kategorii i warstw wagowych z konfiguracji
 * (R16) — realna struktura WORD wymaga stałej liczby pytań KAŻDEJ wagi, nie
 * tylko stałej liczby pytań danego typu, inaczej max punktów jest zmienny
 * zależnie od losowania. Losowość przez wstrzykiwalny RNG.
 *
 * @throws Error gdy pula nie ma dość pytań danej wagi w kategorii.
 */
export function dobierzPytania(
  pula: readonly Pytanie[],
  kategoria: string,
  config: KonfiguracjaEgzaminu = EGZAMIN_WORD_B,
  rng: () => number = Math.random,
): Pytanie[] {
  const wKategorii = pula.filter((q) => q.kategoria === kategoria);
  const podstawowe = wKategorii.filter((q) => q.typ === "podstawowe");
  const specjalistyczne = wKategorii.filter((q) => q.typ === "specjalistyczne");

  return [
    ...config.podstawowe.flatMap((w) => dobierzWarstwe(podstawowe, w, "podstawowych", rng)),
    ...config.specjalistyczne.flatMap((w) => dobierzWarstwe(specjalistyczne, w, "specjalistycznych", rng)),
  ];
}

/**
 * Ocenia podejście (R16): punkty = suma wag poprawnie odpowiedzianych pytań;
 * maxPkt = suma wag wszystkich; zaliczony ⇔ punkty ≥ próg. Brak odpowiedzi =
 * błędna.
 */
export function ocenPodejscie(
  pytania: readonly Pytanie[],
  odpowiedzi: Readonly<Record<string, string>>,
  config: KonfiguracjaEgzaminu = EGZAMIN_WORD_B,
): WynikPodejscia {
  let punkty = 0;
  let maxPkt = 0;
  let liczbaPoprawnych = 0;

  for (const q of pytania) {
    maxPkt += q.waga;
    if (odpowiedzi[q.id] === q.poprawna) {
      punkty += q.waga;
      liczbaPoprawnych += 1;
    }
  }

  return {
    punkty,
    maxPkt,
    zaliczony: punkty >= config.progZaliczenia,
    liczbaPoprawnych,
    liczbaBlednych: pytania.length - liczbaPoprawnych,
  };
}
