import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KalendarzMiesieczny, type WydarzenieKalendarza } from "@/components/ui/calendar-month";
import { GieldaQueueSection } from "./GieldaQueueSection";
import {
  closeEnrollment,
  generatePracticeSchedule,
  generateTheorySchedule,
  getCourse,
  listTheorySessions,
  type KursRow,
  type TheorySessionRow,
} from "./api";

function naWydarzenieKalendarza(s: TheorySessionRow): WydarzenieKalendarza {
  const start = new Date(s.start_ts);
  const end = new Date(s.end_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const sala = s.room ? ` · ${s.room.nazwa}` : "";
  return { data: start, etykieta: `${godzOd}–${godzDo}`, podetykieta: `${s.liczba_godzin}h${sala}` };
}

// Grafik kursu: sesje teorii wygenerowane przez generate-theory (R6), z akcjami
// zamknięcia zapisów i (re)generacji grafiku.
export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const [kurs, setKurs] = React.useState<KursRow | null>(null);
  const [sesje, setSesje] = React.useState<TheorySessionRow[]>([]);
  const [komunikat, setKomunikat] = React.useState<string | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const odswiez = React.useCallback(async () => {
    if (!courseId) return;
    try {
      setKurs(await getCourse(courseId));
      setSesje(await listTheorySessions(courseId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [courseId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function zamknijZapisy() {
    if (!courseId) return;
    setBusy(true);
    setBlad(null);
    try {
      await closeEnrollment(courseId);
      setKomunikat("Zapisy zamknięte. Możesz teraz wygenerować grafik.");
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generujGrafik() {
    if (!courseId) return;
    setBusy(true);
    setBlad(null);
    try {
      const n = await generateTheorySchedule(courseId);
      setKomunikat(`Grafik teorii wygenerowany: ${n} bloków.`);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generujGrafikPraktyki() {
    if (!courseId) return;
    setBusy(true);
    setBlad(null);
    try {
      const wynik = await generatePracticeSchedule(courseId);
      const brak =
        wynik.niedoprzydzieleni.length > 0
          ? ` Brak pełnego pokrycia dla ${wynik.niedoprzydzieleni.length} kursantów (za mało zadeklarowanej dostępności/wolnych okien).`
          : "";
      setKomunikat(`Wysłano ${wynik.przydzielono} propozycji jazd (do potwierdzenia przez kursantów).${brak}`);
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!kurs) return <p>Ładowanie…</p>;

  return (
    <div className="space-y-6">
      <Link to="/panel/kursy" className="text-sm text-[var(--muted-foreground)] hover:underline">
        ← Wróć do listy kursów
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{kurs.nazwa}</CardTitle>
          <CardDescription>
            {kurs.h_teoria}h teorii / {kurs.h_praktyka}h praktyki
            {kurs.data_poczatku && ` · start ${kurs.data_poczatku}`}
            {kurs.docelowy_czas_dni && ` · cel: ${kurs.docelowy_czas_dni} dni`}
            {" · "}
            {kurs.zapisy_otwarte ? "zapisy otwarte" : "zapisy zamknięte"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {komunikat && <p className="text-sm text-green-600">{komunikat}</p>}
          {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
          <div className="flex gap-2">
            {kurs.zapisy_otwarte && (
              <Button onClick={zamknijZapisy} disabled={busy}>
                Zamknij zapisy
              </Button>
            )}
            {!kurs.zapisy_otwarte && (
              <>
                <Button onClick={generujGrafik} disabled={busy}>
                  {sesje.length > 0 ? "Przegeneruj grafik teorii" : "Generuj grafik teorii"}
                </Button>
                <Button variant="outline" onClick={generujGrafikPraktyki} disabled={busy}>
                  Generuj propozycje jazd praktycznych
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grafik teorii</CardTitle>
          <CardDescription>
            {sesje.length > 0
              ? `${sesje.length} bloków, ${sesje.reduce((s, x) => s + x.liczba_godzin, 0)}h łącznie`
              : "Jeszcze nie wygenerowano."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sesje.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {kurs.zapisy_otwarte
                ? "Zamknij zapisy, żeby wygenerować grafik."
                : "Kliknij „Generuj grafik” powyżej."}
            </p>
          ) : (
            <KalendarzMiesieczny wydarzenia={sesje.map(naWydarzenieKalendarza)} />
          )}
        </CardContent>
      </Card>

      <GieldaQueueSection courseId={courseId!} />
    </div>
  );
}
