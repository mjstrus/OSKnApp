import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkingHoursForm, type DaneGodzinBulk } from "./WorkingHoursForm";
import {
  addWorkingHours,
  assignInstructorToCourse,
  deleteInstructor,
  deleteWorkingHours,
  getInstructor,
  getInstructorScore,
  listCourses,
  listInstructorRequestsFor,
  listWorkingHours,
  resendAccessLink,
  setInstructorActive,
  type InstructorRequestSimple,
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

export function InstructorDetail({ oskId }: { oskId: string }) {
  const { instructorId } = useParams<{ instructorId: string }>();
  const navigate = useNavigate();
  const [instruktor, setInstruktor] = React.useState<InstruktorRow | null>(null);
  const [kursy, setKursy] = React.useState<KursRow[]>([]);
  const [godziny, setGodziny] = React.useState<WorkingHoursRow[]>([]);
  const [zgloszenia, setZgloszenia] = React.useState<InstructorRequestSimple[]>([]);
  const [ocena, setOcena] = React.useState<{ srednia: number; liczba: number } | null>(null);
  const [komunikat, setKomunikat] = React.useState<string | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    if (!instructorId) return;
    try {
      const [inst, k, g, z, o] = await Promise.all([
        getInstructor(instructorId),
        listCourses(oskId),
        listWorkingHours(instructorId),
        listInstructorRequestsFor(instructorId),
        getInstructorScore(instructorId),
      ]);
      setInstruktor(inst);
      setKursy(k);
      setGodziny(g);
      setZgloszenia(z);
      setOcena(o);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [instructorId, oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodajGodziny(d: DaneGodzinBulk) {
    if (!instructorId) return;
    setBlad(null);
    try {
      await addWorkingHours(oskId, instructorId, d.dni, d.od_godz, d.do_godz);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usunGodziny(id: string) {
    setBlad(null);
    try {
      await deleteWorkingHours(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function przelaczAktywnosc() {
    if (!instruktor) return;
    setBlad(null);
    try {
      await setInstructorActive(instruktor.id, !instruktor.aktywny);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function wyslijLink() {
    if (!instruktor) return;
    setBlad(null);
    setKomunikat(null);
    try {
      const email = await resendAccessLink(instruktor.id);
      setKomunikat(`Wysłano link dostępu na ${email}.`);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usunInstruktora() {
    if (!instruktor) return;
    const potwierdzone = window.confirm(
      `Usunąć ${instruktor.imie} ${instruktor.nazwisko}? Usunie to też jego godziny pracy, przypisania do kursów i historię slotów jazd.`,
    );
    if (!potwierdzone) return;
    try {
      await deleteInstructor(instruktor.id);
      navigate("/panel/instruktorzy");
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (!instruktor) return <p>Ładowanie…</p>;

  return (
    <div className="space-y-6">
      <Link to="/panel/instruktorzy" className="text-sm text-[var(--muted-foreground)] hover:underline">
        ← Wróć do listy instruktorów
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {instruktor.imie} {instruktor.nazwisko}
          </CardTitle>
          <CardDescription>
            {TYP_LABEL[instruktor.typ] ?? instruktor.typ}
            {instruktor.numer_legitymacji && ` · nr leg. ${instruktor.numer_legitymacji}`}
            {ocena && ` · ocena śr. ${ocena.srednia.toFixed(1)}/5 (${ocena.liczba})`}
          </CardDescription>
        </CardHeader>
        {blad && (
          <CardContent>
            <p className="text-sm text-[var(--destructive)]">{blad}</p>
          </CardContent>
        )}
      </Card>

      {godziny.length === 0 && (
        <Card className="border-[var(--destructive)]">
          <CardContent className="pt-6 text-sm text-[var(--destructive)]">
            Brak ustawionych godzin pracy — instruktor nie będzie brany pod uwagę przy auto-przydziale
            jazd/wykładów.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ustawienia dostępu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={instruktor.aktywny} onChange={przelaczAktywnosc} />
            Konto aktywne
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={wyslijLink}>
              Wyślij nowy link dostępu
            </Button>
            <Button size="sm" variant="outline" className="border-[var(--destructive)] text-[var(--destructive)]" onClick={usunInstruktora}>
              Usuń instruktora
            </Button>
          </div>
          {komunikat && <p className="text-sm text-green-600">{komunikat}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Godziny pracy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1" data-testid="lista-godzin">
            {godziny.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Brak ustawionych godzin pracy.</p>
            )}
            {godziny.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded bg-[var(--muted)] px-2 py-1 text-sm">
                <span>
                  {DNI[g.dzien_tygodnia]} {g.od_godz.slice(0, 5)}–{g.do_godz.slice(0, 5)}
                </span>
                <Button size="sm" variant="ghost" onClick={() => usunGodziny(g.id)}>
                  Usuń
                </Button>
              </div>
            ))}
          </div>
          <WorkingHoursForm onSubmit={dodajGodziny} />
        </CardContent>
      </Card>

      <PrzypiszDoKursu oskId={oskId} instructorId={instruktor.id} kursy={kursy} />

      {zgloszenia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zgłoszenia do admina</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {zgloszenia.map((z) => (
              <div key={z.id} className="border-b border-[var(--border)] py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{z.typ}</span>
                  <span className={z.status === "rozpatrzone" ? "text-green-600" : "text-[var(--muted-foreground)]"}>
                    {z.status === "rozpatrzone" ? "Rozpatrzone" : "Oczekuje"}
                  </span>
                </div>
                <p className="text-[var(--muted-foreground)]">{z.tresc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PrzypiszDoKursu({ oskId, instructorId, kursy }: { oskId: string; instructorId: string; kursy: KursRow[] }) {
  const [courseId, setCourseId] = React.useState(kursy[0]?.id ?? "");
  const [info, setInfo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!courseId && kursy[0]) setCourseId(kursy[0].id);
  }, [kursy, courseId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Przypisz do kursu</CardTitle>
      </CardHeader>
      <CardContent>
        {kursy.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Najpierw dodaj kurs.</p>
        ) : (
          <div className="flex gap-2">
            <select
              aria-label="Kurs"
              className="h-10 flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
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
        )}
        {info && <p className="mt-2 text-sm text-[var(--muted-foreground)]">{info}</p>}
      </CardContent>
    </Card>
  );
}
