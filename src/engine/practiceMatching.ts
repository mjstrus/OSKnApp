// ============================================================================
// Silnik dopasowania grafiku jazd praktycznych (rozszerzenie R6→R7).
//
// Zachłanne, deterministyczne dopasowanie kursant↔instruktor↔slot 1h wg
// zadeklarowanej dostępności kursanta. Round-robin po instruktorach dla
// równomiernego obciążenia. Wynik to PROPOZYCJE (do potwierdzenia przez
// kursanta) — automat statusów i giełda żyją w Edge Functions/DB, tu tylko
// czyste dopasowanie zasobów.
// ============================================================================

import { DLUGOSC_SLOTU_PRAKTYKI_MIN, czyKoliduje, potnijNaSloty, zawieraSie } from "./scheduling.ts";
import type { Interwal } from "./scheduling.ts";

export interface KandydatKursanta {
  enrollmentId: string;
  potrzebneGodziny: number;
  dostepnosc: readonly Interwal[];
}

export interface KandydatInstruktora {
  instructorId: string;
  wolneOkna: readonly Interwal[];
}

export interface PrzydzielonySlot {
  enrollmentId: string;
  instructorId: string;
  start: number;
  end: number;
}

export interface NiedoprzydzielonyKursant {
  enrollmentId: string;
  brakujeGodzin: number;
}

export interface WynikDopasowania {
  przydzielone: PrzydzielonySlot[];
  niedoprzydzieleni: NiedoprzydzielonyKursant[];
}

export function dopasujGrafikPraktyki(
  kursanci: readonly KandydatKursanta[],
  instruktorzy: readonly KandydatInstruktora[],
): WynikDopasowania {
  const wolneSlotyInstr = new Map<string, Interwal[]>();
  for (const instr of instruktorzy) {
    wolneSlotyInstr.set(instr.instructorId, potnijNaSloty(instr.wolneOkna, DLUGOSC_SLOTU_PRAKTYKI_MIN));
  }

  const przydzielone: PrzydzielonySlot[] = [];
  const niedoprzydzieleni: NiedoprzydzielonyKursant[] = [];
  let rotacja = 0;

  for (const kursant of kursanci) {
    let potrzeba = kursant.potrzebneGodziny;
    if (potrzeba <= 0 || instruktorzy.length === 0) {
      if (potrzeba > 0) niedoprzydzieleni.push({ enrollmentId: kursant.enrollmentId, brakujeGodzin: potrzeba });
      continue;
    }

    const kolejnoscInstr = [...instruktorzy.slice(rotacja), ...instruktorzy.slice(0, rotacja)];
    const kandydaci: { instructorId: string; slot: Interwal }[] = [];
    for (const instr of kolejnoscInstr) {
      const sloty = wolneSlotyInstr.get(instr.instructorId) ?? [];
      for (const slot of sloty) {
        if (zawieraSie(slot, kursant.dostepnosc)) {
          kandydaci.push({ instructorId: instr.instructorId, slot });
        }
      }
    }
    kandydaci.sort((a, b) => a.slot.start - b.slot.start);

    const wlasneSloty: Interwal[] = [];
    for (const kand of kandydaci) {
      if (potrzeba <= 0) break;
      if (czyKoliduje(kand.slot, wlasneSloty)) continue;

      przydzielone.push({
        enrollmentId: kursant.enrollmentId,
        instructorId: kand.instructorId,
        start: kand.slot.start,
        end: kand.slot.end,
      });
      wlasneSloty.push(kand.slot);
      potrzeba--;

      const pulaInstr = wolneSlotyInstr.get(kand.instructorId)!;
      wolneSlotyInstr.set(
        kand.instructorId,
        pulaInstr.filter((s) => !(s.start === kand.slot.start && s.end === kand.slot.end)),
      );
    }

    if (potrzeba > 0) {
      niedoprzydzieleni.push({ enrollmentId: kursant.enrollmentId, brakujeGodzin: potrzeba });
    }

    rotacja = (rotacja + 1) % instruktorzy.length;
  }

  return { przydzielone, niedoprzydzieleni };
}
