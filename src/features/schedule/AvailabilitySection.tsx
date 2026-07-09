import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkingHoursForm, type DaneGodzinBulk } from "@/features/admin/WorkingHoursForm";
import { rozwinDostepnosc } from "@/features/onboarding/submitApplication";
import { addAvailability, deleteAvailability, listMyAvailability, type OknoDostepnosciRow } from "./api";

const DNI = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const czas = (iso: string) => iso.slice(11, 16);

/** Grupuje wygenerowane okna po (dzień tygodnia, godziny) dla czytelnego widoku. */
function grupuj(okna: OknoDostepnosciRow[]) {
  const grupy = new Map<string, { dzien: number; od: string; do: string; ids: string[] }>();
  for (const o of okna) {
    const start = new Date(o.start_ts);
    const dzien = (start.getDay() + 6) % 7;
    const klucz = `${dzien}-${czas(o.start_ts)}-${czas(o.end_ts)}`;
    const g = grupy.get(klucz) ?? { dzien, od: czas(o.start_ts), do: czas(o.end_ts), ids: [] };
    g.ids.push(o.id);
    grupy.set(klucz, g);
  }
  return [...grupy.values()];
}

export function AvailabilitySection({ oskId, enrollmentId }: { oskId: string; enrollmentId: string }) {
  const [okna, setOkna] = React.useState<OknoDostepnosciRow[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setOkna(await listMyAvailability(enrollmentId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [enrollmentId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodaj(d: DaneGodzinBulk) {
    setBlad(null);
    try {
      await addAvailability(oskId, enrollmentId, rozwinDostepnosc(d.dni, d.od_godz, d.do_godz));
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usunGrupe(ids: string[]) {
    setBlad(null);
    try {
      await Promise.all(ids.map(deleteAvailability));
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moja dostępność na jazdy</CardTitle>
        <CardDescription>Wpływa na automatyczne dopasowanie terminów jazd praktycznych.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        {grupuj(okna).length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak zadeklarowanej dostępności.</p>
        )}
        {grupuj(okna).map((g) => (
          <div
            key={`${g.dzien}-${g.od}-${g.do}`}
            className="flex items-center justify-between rounded bg-[var(--muted)] px-3 py-2 text-sm"
          >
            <span>
              {DNI[g.dzien]} {g.od}–{g.do}
            </span>
            <Button size="sm" variant="ghost" onClick={() => usunGrupe(g.ids)}>
              Usuń
            </Button>
          </div>
        ))}
        <WorkingHoursForm
          etykietaDni="Dni"
          tekstPrzycisku="Dodaj zakres dostępności"
          onSubmit={dodaj}
        />
      </CardContent>
    </Card>
  );
}
