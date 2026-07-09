/**
 * Silnik weryfikacji pojemności kursu (R2 rozszerzenie).
 *
 * Admin wpisuje docelowy czas realizacji kursu (dni) — silnik sprawdza, czy
 * zasoby OSK (sale, auta, instruktorzy i ich godziny pracy) fizycznie
 * pozwalają zmieścić h_teoria/h_praktyka w tym oknie, dla max_uczestnicy osób.
 *
 * Uproszczenia modelu (świadome, dokumentowane — nie pełna symulacja slotów
 * jak scheduling.ts, tylko szacunek zasobowy przy zakładaniu kursu):
 * - Teoria: jedna grupa = jedna sala na cały czas trwania; sala musi pomieścić
 *   max_uczestnicy, a łączne godziny pracy wykładowców w oknie muszą pokryć h_teoria.
 * - Praktyka: każda godzina jazdy zajmuje JEDNOCZEŚNIE instruktora i auto.
 *   Jeśli aut jest mniej niż instruktorów praktyki, auta są wąskim gardłem —
 *   efektywna dostępność godzin jazd skaluje się proporcjonalnie
 *   (liczbaAut / liczbaInstruktorow), bo część godzin pracy instruktorów
 *   nie ma z czym jeździć.
 */

export interface ZasobyOsk {
  sale: { pojemnosc: number }[];
  liczbaAktywnychAut: number;
  liczbaInstruktorowPraktyki: number;
  godzinyInstruktorowPraktykiTygodniowo: number; // suma godzin pracy wszystkich instruktorów praktyki
  godzinyWykladowcowTygodniowo: number; // suma godzin pracy wszystkich wykładowców
}

export interface ParametryKursu {
  hTeoria: number;
  hPraktyka: number;
  maxUczestnicy: number;
  docelowyCzasDni: number;
}

export interface WynikWeryfikacjiPojemnosci {
  ok: boolean;
  problemy: string[];
}

const DNI_W_TYGODNIU = 7;

export function zweryfikujPojemnoscKursu(
  kurs: ParametryKursu,
  zasoby: ZasobyOsk,
): WynikWeryfikacjiPojemnosci {
  const problemy: string[] = [];
  const tygodnie = kurs.docelowyCzasDni / DNI_W_TYGODNIU;

  // --- Teoria: rozmiar sali ---
  const maxPojemnoscSali = Math.max(0, ...zasoby.sale.map((s) => s.pojemnosc));
  if (zasoby.sale.length === 0) {
    problemy.push("Brak zdefiniowanych sal wykładowych.");
  } else if (kurs.maxUczestnicy > maxPojemnoscSali) {
    problemy.push(
      `Żadna sala nie pomieści ${kurs.maxUczestnicy} kursantów (największa ma ${maxPojemnoscSali} miejsc).`,
    );
  }

  // --- Teoria: godziny wykładowców ---
  const dostepneGodzinyTeorii = zasoby.godzinyWykladowcowTygodniowo * tygodnie;
  if (dostepneGodzinyTeorii < kurs.hTeoria) {
    problemy.push(
      `Za mało godzin wykładowców: potrzeba ${kurs.hTeoria}h, dostępne ${dostepneGodzinyTeorii.toFixed(1)}h w ${kurs.docelowyCzasDni} dniach.`,
    );
  }

  // --- Praktyka: instruktorzy x auta ---
  if (zasoby.liczbaInstruktorowPraktyki === 0) {
    problemy.push("Brak instruktorów praktyki.");
  }
  if (zasoby.liczbaAktywnychAut === 0) {
    problemy.push("Brak aktywnych aut w flocie.");
  }

  if (zasoby.liczbaInstruktorowPraktyki > 0 && zasoby.liczbaAktywnychAut > 0) {
    const potrzebneGodzinyPraktyki = kurs.hPraktyka * kurs.maxUczestnicy;
    const dostepneGodzinyInstruktorow = zasoby.godzinyInstruktorowPraktykiTygodniowo * tygodnie;
    const wspolczynnikAut = Math.min(
      1,
      zasoby.liczbaAktywnychAut / zasoby.liczbaInstruktorowPraktyki,
    );
    const efektywneGodzinyPraktyki = dostepneGodzinyInstruktorow * wspolczynnikAut;

    if (efektywneGodzinyPraktyki < potrzebneGodzinyPraktyki) {
      const brakuje = potrzebneGodzinyPraktyki - efektywneGodzinyPraktyki;
      const uwagaAut =
        wspolczynnikAut < 1
          ? ` (auta są wąskim gardłem: ${zasoby.liczbaAktywnychAut} aut / ${zasoby.liczbaInstruktorowPraktyki} instruktorów)`
          : "";
      problemy.push(
        `Za mało mocy na jazdy: potrzeba ${potrzebneGodzinyPraktyki}h, efektywnie dostępne ${efektywneGodzinyPraktyki.toFixed(1)}h w ${kurs.docelowyCzasDni} dniach — brakuje ok. ${brakuje.toFixed(1)}h${uwagaAut}.`,
      );
    }
  }

  return { ok: problemy.length === 0, problemy };
}
