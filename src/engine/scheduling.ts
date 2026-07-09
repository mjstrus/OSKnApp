// ============================================================================
// Unit 3 — silnik terminarza (R6, R7, R8, R9, R10)
//
// Czyste funkcje: algebra interwałów, model dostępności, walidacja rezerwacji
// i auto-harmonogram teorii. Bez zależności od DB/UI — Edge Functions
// (book-slot, generate-theory) to cienka warstwa wokół tych funkcji, a DB
// (constraint EXCLUDE) pełni rolę guardraila pod współbieżnością.
//
// Czas reprezentujemy jako liczbę minut od umownego zera (np. epoch-minutes).
// Interwały są półotwarte: [start, end).
// ============================================================================

/** Praktyka: slot = 1 godzina zegarowa (R7, 60 min praktyki). */
export const DLUGOSC_SLOTU_PRAKTYKI_MIN = 60;

/** Teoria: godzina lekcyjna = 45 min (wymogi kat. B). */
export const GODZINA_TEORII_MIN = 45;

/** Półotwarty przedział czasu [start, end) w minutach. */
export interface Interwal {
  start: number;
  end: number;
}

export interface BlokTeorii {
  start: number;
  end: number;
  liczbaGodzin: number;
}

export type WynikWalidacji = { ok: true } | { ok: false; powod: string };

const pusty = (i: Interwal): boolean => i.end <= i.start;

/**
 * Normalizuje listę interwałów: sortuje po starcie i łączy nachodzące oraz
 * stykające się krawędzią (koniec == początek).
 */
export function scal(interwaly: readonly Interwal[]): Interwal[] {
  const posortowane = interwaly
    .filter((i) => !pusty(i))
    .slice()
    .sort((a, b) => a.start - b.start);

  const wynik: Interwal[] = [];
  for (const i of posortowane) {
    const ostatni = wynik[wynik.length - 1];
    if (ostatni && i.start <= ostatni.end) {
      ostatni.end = Math.max(ostatni.end, i.end);
    } else {
      wynik.push({ ...i });
    }
  }
  return wynik;
}

/** Różnica: fragmenty `baza` nieprzykryte przez `zajete`. */
export function odejmij(baza: readonly Interwal[], zajete: readonly Interwal[]): Interwal[] {
  const przeszkody = scal(zajete);
  const wynik: Interwal[] = [];

  for (const okno of scal(baza)) {
    let kursor = okno.start;
    for (const z of przeszkody) {
      if (z.end <= kursor || z.start >= okno.end) continue; // brak nakładania
      if (z.start > kursor) wynik.push({ start: kursor, end: z.start });
      kursor = Math.max(kursor, z.end);
      if (kursor >= okno.end) break;
    }
    if (kursor < okno.end) wynik.push({ start: kursor, end: okno.end });
  }
  return wynik;
}

/** Część wspólna dwóch list interwałów. */
export function przetnij(a: readonly Interwal[], b: readonly Interwal[]): Interwal[] {
  const x = scal(a);
  const y = scal(b);
  const wynik: Interwal[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const start = Math.max(x[i]!.start, y[j]!.start);
    const end = Math.min(x[i]!.end, y[j]!.end);
    if (start < end) wynik.push({ start, end });
    if (x[i]!.end < y[j]!.end) i++;
    else j++;
  }
  return wynik;
}

/** Tnie interwały na kolejne sloty stałej długości; resztę < slotu odrzuca. */
export function potnijNaSloty(interwaly: readonly Interwal[], dlugosc: number): Interwal[] {
  const wynik: Interwal[] = [];
  for (const okno of scal(interwaly)) {
    let start = okno.start;
    while (start + dlugosc <= okno.end) {
      wynik.push({ start, end: start + dlugosc });
      start += dlugosc;
    }
  }
  return wynik;
}

/** Wolne okna instruktora = godziny pracy − zajęte sloty (R7). */
export function wolneOknaInstruktora(
  godzinyPracy: readonly Interwal[],
  zajeteSloty: readonly Interwal[],
): Interwal[] {
  return odejmij(godzinyPracy, zajeteSloty);
}

/**
 * Dostępne sloty praktyki = przecięcie wolnych okien instruktora z dostępnością
 * kursanta, pocięte na jednostki 1 h (R7).
 */
export function dostepneSlotyPraktyki(
  wolneInstruktora: readonly Interwal[],
  dostepnoscKursanta: readonly Interwal[],
  dlugosc: number = DLUGOSC_SLOTU_PRAKTYKI_MIN,
): Interwal[] {
  return potnijNaSloty(przetnij(wolneInstruktora, dostepnoscKursanta), dlugosc);
}

/** Czy `slot` mieści się w całości w którymś z `okna`. */
export function zawieraSie(slot: Interwal, okna: readonly Interwal[]): boolean {
  return scal(okna).some((o) => o.start <= slot.start && slot.end <= o.end);
}

/** Czy `nowy` nakłada się (nie tylko styka) z którymkolwiek z `istniejace`. */
export function czyKoliduje(nowy: Interwal, istniejace: readonly Interwal[]): boolean {
  return istniejace.some((i) => nowy.start < i.end && i.start < nowy.end);
}

export interface ParametryRezerwacji {
  slot: Interwal;
  wolneOknaInstruktora: readonly Interwal[];
  dostepnoscKursanta: readonly Interwal[];
  /** Aktywne sloty instruktora (zaplanowane/odbyte) — do wykrycia kolizji. */
  slotyInstruktora: readonly Interwal[];
  /** Aktywne sloty kursanta — kursant nie może być w dwóch miejscach naraz. */
  slotyKursanta: readonly Interwal[];
  /** R14b: bez „dopuszczony do jazd" rezerwacja praktyki jest odrzucona. */
  clearedToDrive: boolean;
  dlugoscSlotu?: number;
}

/**
 * Waliduje pojedynczą rezerwację praktyki (R7, R10, R14b). Logika kolizji jest
 * tu, ale twarda gwarancja pod współbieżnością to constraint EXCLUDE w DB
 * (0003) — book-slot polega na obu.
 *
 * Reguła R10 „max 2 h na raz w pierwszych 8 h" jest spełniona samą długością
 * slotu 1 h (walidujemy dokładnie 1 h), więc nie wymaga osobnej gałęzi.
 */
export function walidujRezerwacje(p: ParametryRezerwacji): WynikWalidacji {
  const dlugosc = p.dlugoscSlotu ?? DLUGOSC_SLOTU_PRAKTYKI_MIN;

  if (!p.clearedToDrive) {
    return { ok: false, powod: "Kursant nie jest dopuszczony do jazd (R14b)." };
  }
  if (p.slot.end - p.slot.start !== dlugosc) {
    return { ok: false, powod: `Slot musi mieć dokładnie 1 h (${dlugosc} min).` };
  }
  if (!zawieraSie(p.slot, p.wolneOknaInstruktora)) {
    return { ok: false, powod: "Slot poza wolnym oknem instruktora." };
  }
  if (!zawieraSie(p.slot, p.dostepnoscKursanta)) {
    return { ok: false, powod: "Slot poza zadeklarowaną dostępnością kursanta." };
  }
  if (czyKoliduje(p.slot, p.slotyInstruktora)) {
    return { ok: false, powod: "Instruktor ma już rezerwację w tym czasie." };
  }
  if (czyKoliduje(p.slot, p.slotyKursanta)) {
    return { ok: false, powod: "Kursant ma już rezerwację w tym czasie." };
  }
  return { ok: true };
}

export interface GodzinyTygodniowe {
  dzienTygodnia: number; // 0 = poniedziałek … 6 = niedziela
  odMin: number; // minuty od północy
  doMin: number;
}

const MINUT_W_DNIU = 24 * 60;

/**
 * Rozwija cykliczne tygodniowe godziny pracy w konkretne interwały (te same
 * jednostki co `poniedzialekEpochMin`, zwykle epoch-minuty 00:00 poniedziałku)
 * na zadanym horyzoncie tygodni. Współdzielone przez generate-theory i
 * generate-practice-schedule.
 */
export function rozwinGodzinyTygodniowe(
  godziny: readonly GodzinyTygodniowe[],
  poniedzialekEpochMin: number,
  horyzontTygodni: number,
): Interwal[] {
  const wynik: Interwal[] = [];
  for (let tydzien = 0; tydzien < horyzontTygodni; tydzien++) {
    for (const g of godziny) {
      const bazaDnia = poniedzialekEpochMin + (tydzien * 7 + g.dzienTygodnia) * MINUT_W_DNIU;
      wynik.push({ start: bazaDnia + g.odMin, end: bazaDnia + g.doMin });
    }
  }
  return wynik;
}

/**
 * Auto-harmonogram teorii (R6): pakuje `hTeoria` godzin lekcyjnych w okna pracy
 * wykładowcy, zachłannie od najwcześniejszego okna. Zwraca bloki (po jednym na
 * okno, tak duże jak się zmieści), których łączna liczba godzin == hTeoria.
 *
 * @throws Error gdy okna wykładowcy nie mieszczą wymaganej liczby godzin.
 */
export function generujBlokiTeorii(
  oknaWykladowcy: readonly Interwal[],
  hTeoria: number,
  godzinaLekcyjnaMin: number = GODZINA_TEORII_MIN,
): BlokTeorii[] {
  if (hTeoria <= 0) return [];

  const bloki: BlokTeorii[] = [];
  let pozostale = hTeoria;

  for (const okno of scal(oknaWykladowcy)) {
    if (pozostale === 0) break;
    const pojemnosc = Math.floor((okno.end - okno.start) / godzinaLekcyjnaMin);
    const wezmij = Math.min(pojemnosc, pozostale);
    if (wezmij > 0) {
      bloki.push({
        start: okno.start,
        end: okno.start + wezmij * godzinaLekcyjnaMin,
        liczbaGodzin: wezmij,
      });
      pozostale -= wezmij;
    }
  }

  if (pozostale > 0) {
    throw new Error(
      `Okna wykładowcy są niewystarczające: brakuje ${pozostale} h teorii do rozpisania.`,
    );
  }
  return bloki;
}
