import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffForm } from "./StaffForm";
import { InstructorRequestsSection } from "./InstructorRequestsSection";
import { WorkingHoursForm, type DaneGodzinBulk } from "./WorkingHoursForm";
import {
  addWorkingHours,
  assignInstructorToCourse,
  createStaff,
  deleteInstructor,
  deleteWorkingHours,
  listInstructors,
  listWorkingHours,
  type InstruktorRow,
  type KursRow,
  type WorkingHoursRow,
} from "./api";

const TYP_LABEL: Record<string, string> = {
  instruktor_praktyki: "instruktor praktyki",
  wykladowca: "wykładowca",
  instruktor_2w1: "instruktor 2w1",
};

const DNI = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

export function InstructorsSection({ oskId, kursy }: { oskId: string; kursy: KursRow[] }) {
  const [instruktorzy, setInstruktorzy] = React.useState<InstruktorRow[]>([]);
  const [rozwiniety, setRozwiniety] = React.useState<string | null>(null);
  const [komunikat, setKomunikat] = React.useState<string | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setInstruktorzy(await listInstructors(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodaj(d: Parameters<typeof createStaff>[0]) {
    setBlad(null);
    setKomunikat(null);
    try {
      await createStaff(d);
      setKomunikat(`Dodano konto ${d.email}. Może się już zalogować.`);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usunInstruktora(i: InstruktorRow) {
    const potwierdzone = window.confirm(
      `Usunąć ${i.imie} ${i.nazwisko}? Usunie to też jego godziny pracy, przypisania do kursów i historię slotów jazd.`,
    );
    if (!potwierdzone) return;
    setBlad(null);
    try {
      await deleteInstructor(i.id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <InstructorRequestsSection oskId={oskId} />
      <Card id="nowy-instruktor">
        <CardHeader>
          <CardTitle>Nowy instruktor / wykładowca</CardTitle>
          <CardDescription>Tworzy konto i przypisuje rolę w OSK (R3).</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffForm onSubmit={dodaj} />
          {komunikat && <p className="mt-2 text-sm text-green-600">{komunikat}</p>}
          {blad && <p className="mt-2 text-sm text-[var(--destructive)]">{blad}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruktorzy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {instruktorzy.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Brak instruktorów.</p>
          )}
          {instruktorzy.map((i) => (
            <div key={i.id} className="border-b border-[var(--border)] py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {i.imie} {i.nazwisko} — {TYP_LABEL[i.typ] ?? i.typ}
                  {i.numer_legitymacji && (
                    <span className="text-[var(--muted-foreground)]"> (nr leg. {i.numer_legitymacji})</span>
                  )}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRozwiniety(rozwiniety === i.id ? null : i.id)}
                  >
                    {rozwiniety === i.id ? "Zwiń" : "Godziny / przypisanie"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => usunInstruktora(i)}>
                    Usuń
                  </Button>
                </div>
              </div>
              {rozwiniety === i.id && (
                <div className="mt-3 space-y-4 rounded-md bg-[var(--muted)] p-3">
                  <PrzypiszDoKursu oskId={oskId} instructorId={i.id} kursy={kursy} />
                  <GodzinyPracy oskId={oskId} instructorId={i.id} />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function GodzinyPracy({ oskId, instructorId }: { oskId: string; instructorId: string }) {
  const [godziny, setGodziny] = React.useState<WorkingHoursRow[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setGodziny(await listWorkingHours(instructorId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [instructorId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodaj(d: DaneGodzinBulk) {
    setBlad(null);
    try {
      await addWorkingHours(oskId, instructorId, d.dni, d.od_godz, d.do_godz);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usun(id: string) {
    setBlad(null);
    try {
      await deleteWorkingHours(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">Godziny pracy</span>
      {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
      <div className="space-y-1" data-testid="lista-godzin">
        {godziny.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak ustawionych godzin pracy.</p>
        )}
        {godziny.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded bg-white px-2 py-1 text-sm">
            <span>
              {DNI[g.dzien_tygodnia]} {g.od_godz.slice(0, 5)}–{g.do_godz.slice(0, 5)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => usun(g.id)}>
              Usuń
            </Button>
          </div>
        ))}
      </div>
      <WorkingHoursForm onSubmit={dodaj} />
    </div>
  );
}

function PrzypiszDoKursu({
  oskId,
  instructorId,
  kursy,
}: {
  oskId: string;
  instructorId: string;
  kursy: KursRow[];
}) {
  const [courseId, setCourseId] = React.useState(kursy[0]?.id ?? "");
  const [info, setInfo] = React.useState<string | null>(null);

  if (kursy.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">Najpierw dodaj kurs.</p>;
  }
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Przypisz do kursu</span>
      <div className="flex gap-2">
        <select
          aria-label="Kurs"
          className="h-10 flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {kursy.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nazwa}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await assignInstructorToCourse(oskId, courseId, instructorId);
              setInfo("Przypisano.");
            } catch (e) {
              setInfo((e as Error).message);
            }
          }}
        >
          Przypisz
        </Button>
      </div>
      {info && <p className="text-sm text-[var(--muted-foreground)]">{info}</p>}
    </div>
  );
}
