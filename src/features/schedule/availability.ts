// ============================================================================
// Wyliczanie wolnych slotów kursanta — cienki adapter nad silnikiem scheduling.
// Rozwija tygodniowe godziny pracy instruktora w konkretne okna na horyzoncie,
// odejmuje zajęte sloty, przecina z dostępnością kursanta i tnie na 1 h.
// Czyste (deterministyczne) — testowalne bez DB.
// ============================================================================

import {
  dostepneSlotyPraktyki,
  wolneOknaInstruktora,
  type Interwal,
} from "@/engine/scheduling";
import type { SlotDoRezerwacji, SlotView } from "./types";

export interface GodzinyPracy {
  dzien_tygodnia: number; // 0 = poniedziałek … 6 = niedziela
  od_godz: string; // "HH:MM[:SS]"
  do_godz: string;
}

export interface OknoISO {
  start_ts: string;
  end_ts: string;
}

const MIN = 60000;
const naMin = (iso: string): number => Math.floor(Date.parse(iso) / MIN);
const czasNaMin = (t: string): number => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};
const dowUTC = (d: Date): number => (d.getUTCDay() + 6) % 7;

/** Rozwija cotygodniowe godziny pracy w konkretne okna (epoch-min) na horyzoncie. */
function rozwinGodziny(godziny: GodzinyPracy[], odDaty: Date, dni: number): Interwal[] {
  const start = new Date(Date.UTC(odDaty.getUTCFullYear(), odDaty.getUTCMonth(), odDaty.getUTCDate()));
  const okna: Interwal[] = [];
  for (let i = 0; i < dni; i++) {
    const dzien = new Date(start);
    dzien.setUTCDate(dzien.getUTCDate() + i);
    const bazaMin = Math.floor(dzien.getTime() / MIN);
    for (const g of godziny) {
      if (g.dzien_tygodnia === dowUTC(dzien)) {
        okna.push({ start: bazaMin + czasNaMin(g.od_godz), end: bazaMin + czasNaMin(g.do_godz) });
      }
    }
  }
  return okna;
}

/**
 * Wolne sloty praktyki u danego instruktora dla kursanta (R7).
 * @param odDaty początek horyzontu; @param dni liczba dni w przód.
 */
export function wolneSlotyKursanta(params: {
  instructorId: string;
  godzinyPracy: GodzinyPracy[];
  zajeteSloty: OknoISO[];
  dostepnoscKursanta: OknoISO[];
  odDaty?: Date;
  dni?: number;
}): SlotDoRezerwacji[] {
  const odDaty = params.odDaty ?? new Date();
  const dni = params.dni ?? 14;

  const oknaPracy = rozwinGodziny(params.godzinyPracy, odDaty, dni);
  const zajete = params.zajeteSloty.map((s) => ({ start: naMin(s.start_ts), end: naMin(s.end_ts) }));
  const dostepnosc = params.dostepnoscKursanta.map((s) => ({
    start: naMin(s.start_ts),
    end: naMin(s.end_ts),
  }));

  const wolne = wolneOknaInstruktora(oknaPracy, zajete);
  return dostepneSlotyPraktyki(wolne, dostepnosc).map((slot) => ({
    instructor_id: params.instructorId,
    start_ts: new Date(slot.start * MIN).toISOString(),
    end_ts: new Date(slot.end * MIN).toISOString(),
  }));
}

/** Zajęte okna z listy slotów (do odjęcia od godzin pracy). */
export function zajeteZeSlotow(sloty: SlotView[]): OknoISO[] {
  return sloty
    .filter((s) => s.status === "zaplanowany" || s.status === "odbyty")
    .map((s) => ({ start_ts: s.start_ts, end_ts: s.end_ts }));
}
