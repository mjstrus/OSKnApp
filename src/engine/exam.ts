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

export interface KonfiguracjaEgzaminu {
  liczbaPodstawowych: number;
  liczbaSpecjalistycznych: number;
  progZaliczenia: number;
  maxPkt: number;
  czasSekundy: number;
}

/** Domyślny format egzaminu teoretycznego kat. B (WORD): 32 pytania, 25 min, 68/74. */
export const EGZAMIN_WORD_B: KonfiguracjaEgzaminu = {
  liczbaPodstawowych: 20,
  liczbaSpecjalistycznych: 12,
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

/**
 * Dobiera pytania do symulacji wg kategorii i formatu (R16): tyle podstawowych i
 * specjalistycznych, ile w konfiguracji. Losowość przez wstrzykiwalny RNG.
 *
 * @throws Error gdy pula nie ma dość pytań danego typu w kategorii.
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

  if (podstawowe.length < config.liczbaPodstawowych) {
    throw new Error(
      `Za mało pytań podstawowych kat. ${kategoria}: jest ${podstawowe.length}, wymagane ${config.liczbaPodstawowych}.`,
    );
  }
  if (specjalistyczne.length < config.liczbaSpecjalistycznych) {
    throw new Error(
      `Za mało pytań specjalistycznych kat. ${kategoria}: jest ${specjalistyczne.length}, wymagane ${config.liczbaSpecjalistycznych}.`,
    );
  }

  return [
    ...potasuj(podstawowe, rng).slice(0, config.liczbaPodstawowych),
    ...potasuj(specjalistyczne, rng).slice(0, config.liczbaSpecjalistycznych),
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
