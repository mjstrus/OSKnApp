// ============================================================================
// Unit 4 — walidacja zgłoszenia kandydata (R4)
//
// Czysta, testowalna logika kompletności zgłoszenia: wymagane pola, zgoda RODO,
// próg wieku i zgoda opiekuna dla niepełnoletnich. Bez zależności od DB/UI —
// reużywana w Edge Function submit-application i w formularzu React (Unit 6).
//
// Kontekst prawny (kat. B, od 3 marca 2026): kurs można rozpocząć do 3 miesięcy
// przed 17. urodzinami → minimalny wiek = 16 lat 9 miesięcy. Osoby < 18 lat
// (niepełnoletnie) wymagają zgody opiekuna.
// ============================================================================

/** Minimalny wiek rozpoczęcia kursu: 17 lat − 3 miesiące. */
export const WIEK_MIN_LATA = 16;
export const WIEK_MIN_MIESIACE = 9;

export interface DaneZgloszenia {
  imie: string;
  nazwisko: string;
  email: string;
  telefon: string;
  kategoria: string;
  /** Numer PKK jako zwykłe pole tekstowe (bez integracji, R4). */
  pkkNumber: string;
  /** Data urodzenia w formacie ISO (YYYY-MM-DD). */
  dataUrodzenia: string;
  zgodaRodo: boolean;
  zgodaOpiekuna: boolean;
  /** Dzień, względem którego liczymy wiek; domyślnie dziś. */
  dataStartuKursu?: string;
}

export type WynikZgloszenia = { ok: true } | { ok: false; braki: string[] };

const pusty = (s: unknown): boolean => typeof s !== "string" || s.trim().length === 0;

// Prosty, celowo liberalny sanity-check formatu e-mail.
const poprawnyEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function tylkoData(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Czy `dataUrodzenia + (lata, miesiace)` wypada w dniu `wDniu` lub wcześniej. */
function osiagaWiek(
  dataUrodzenia: string,
  wDniu: string,
  lata: number,
  miesiace: number,
): boolean {
  const ur = tylkoData(dataUrodzenia);
  const prog = new Date(ur);
  prog.setUTCMonth(prog.getUTCMonth() + lata * 12 + miesiace);
  return prog.getTime() <= tylkoData(wDniu).getTime();
}

/** Czy kandydat jest niepełnoletni (< 18 lat) w dniu `wDniu` (domyślnie dziś). */
export function czyNiepelnoletni(dataUrodzenia: string, wDniu?: string): boolean {
  const ref = wDniu ?? new Date().toISOString();
  return !osiagaWiek(dataUrodzenia, ref, 18, 0);
}

/**
 * Waliduje kompletność zgłoszenia (R4). Zwraca listę braków; gdy pusta — ok.
 * Nie tworzy niczego w bazie — to robi maker-checker (approve-application).
 */
export function walidujZgloszenie(dane: DaneZgloszenia): WynikZgloszenia {
  const braki: string[] = [];
  const wDniu = dane.dataStartuKursu ?? new Date().toISOString();

  if (pusty(dane.imie)) braki.push("imię");
  if (pusty(dane.nazwisko)) braki.push("nazwisko");
  if (pusty(dane.telefon)) braki.push("telefon");
  if (pusty(dane.kategoria)) braki.push("kategoria");
  if (pusty(dane.pkkNumber)) braki.push("numer PKK");
  if (pusty(dane.dataUrodzenia)) braki.push("data urodzenia");

  if (pusty(dane.email)) braki.push("email");
  else if (!poprawnyEmail(dane.email)) braki.push("email w poprawnym formacie");

  if (!dane.zgodaRodo) braki.push("zgoda RODO");

  // Wiek liczymy tylko, gdy mamy sensowną datę urodzenia.
  if (!pusty(dane.dataUrodzenia)) {
    const dostatecznieStary = osiagaWiek(
      dane.dataUrodzenia,
      wDniu,
      WIEK_MIN_LATA,
      WIEK_MIN_MIESIACE,
    );
    if (!dostatecznieStary) {
      braki.push("wymagany minimalny wiek (za młody na rozpoczęcie kursu)");
    } else if (czyNiepelnoletni(dane.dataUrodzenia, wDniu) && !dane.zgodaOpiekuna) {
      braki.push("zgoda opiekuna (kandydat niepełnoletni)");
    }
  }

  return braki.length === 0 ? { ok: true } : { ok: false, braki };
}
