// ============================================================================
// Unit 5 — leaderboard kursu (R17)
//
// Metryka jest WYODRĘBNIONA (łatwa do zmiany): domyślnie ranking po najlepszym
// wyniku symulacji, tie-break po liczbie ukończonych testów. Agreguje podejścia
// w trybie symulacji (filtrowanie po trybie robi warstwa danych/RLS).
// ============================================================================

export interface PodejscieSymulacji {
  enrollmentId: string;
  punkty: number;
}

export interface PozycjaLeaderboard {
  enrollmentId: string;
  najlepszyWynik: number;
  liczbaTestow: number;
  pozycja: number;
}

/** Metryka rankingu: >0 gdy `a` wyżej niż `b`. Podmienialna bez ruszania reszty. */
export type Metryka = (a: PozycjaLeaderboard, b: PozycjaLeaderboard) => number;

export const METRYKA_DOMYSLNA: Metryka = (a, b) =>
  b.najlepszyWynik - a.najlepszyWynik || b.liczbaTestow - a.liczbaTestow;

export function zbudujLeaderboard(
  podejscia: readonly PodejscieSymulacji[],
  metryka: Metryka = METRYKA_DOMYSLNA,
): PozycjaLeaderboard[] {
  // Agregacja per kursant: najlepszy wynik + liczba podejść.
  const agg = new Map<string, PozycjaLeaderboard>();
  for (const p of podejscia) {
    const dotychczas = agg.get(p.enrollmentId);
    if (dotychczas) {
      dotychczas.najlepszyWynik = Math.max(dotychczas.najlepszyWynik, p.punkty);
      dotychczas.liczbaTestow += 1;
    } else {
      agg.set(p.enrollmentId, {
        enrollmentId: p.enrollmentId,
        najlepszyWynik: p.punkty,
        liczbaTestow: 1,
        pozycja: 0,
      });
    }
  }

  const wiersze = [...agg.values()].sort(
    (a, b) => metryka(a, b) || a.enrollmentId.localeCompare(b.enrollmentId),
  );

  // Ranking sportowy: remisujący (wg metryki) dzielą pozycję, następny przeskakuje.
  wiersze.forEach((w, i) => {
    const poprzedni = wiersze[i - 1];
    w.pozycja = poprzedni && metryka(poprzedni, w) === 0 ? poprzedni.pozycja : i + 1;
  });

  return wiersze;
}
