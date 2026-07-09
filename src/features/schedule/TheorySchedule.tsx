import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KalendarzMiesieczny, type WydarzenieKalendarza } from "@/components/ui/calendar-month";
import { listTheorySessions, type TheorySessionRow } from "@/features/admin/api";
import type { SlotView } from "./types";

const KOLOR_PRAKTYKA: Record<SlotView["status"], WydarzenieKalendarza["kolor"]> = {
  zaplanowany: "domyslny",
  odbyty: "sukces",
  usprawiedliwiony: "domyslny",
  odwolany_w_oknie: "alarm",
  nieusprawiedliwiony: "alarm",
};

function teoriaNaWydarzenie(s: TheorySessionRow): WydarzenieKalendarza {
  const start = new Date(s.start_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = new Date(s.end_ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const sala = s.room ? ` · ${s.room.nazwa}${s.room.adres ? `, ${s.room.adres}` : ""}` : "";
  return { data: start, etykieta: `${godzOd}–${godzDo}`, podetykieta: `Teoria${sala}` };
}

function praktykaNaWydarzenie(s: SlotView): WydarzenieKalendarza {
  const start = new Date(s.start_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = new Date(s.end_ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return { data: start, etykieta: `${godzOd}–${godzDo}`, podetykieta: "Jazda", kolor: KOLOR_PRAKTYKA[s.status] };
}

/** Grafik kursu — teoria (odczyt, RLS: każdy członek OSK widzi plan wykładów) + własne jazdy, jeden kalendarz. */
export function TheorySchedule({ courseId, mojeSloty = [] }: { courseId: string; mojeSloty?: SlotView[] }) {
  const [sesje, setSesje] = React.useState<TheorySessionRow[]>([]);

  React.useEffect(() => {
    void listTheorySessions(courseId).then(setSesje);
  }, [courseId]);

  if (sesje.length === 0 && mojeSloty.length === 0) return null;

  const godzinyTeorii = sesje.reduce((s, x) => s + x.liczba_godzin, 0);
  const wydarzenia = [...sesje.map(teoriaNaWydarzenie), ...mojeSloty.map(praktykaNaWydarzenie)];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grafik</CardTitle>
        <CardDescription>
          {sesje.length} bloków teorii ({godzinyTeorii}h), {mojeSloty.length} jazd praktycznych
        </CardDescription>
      </CardHeader>
      <CardContent>
        <KalendarzMiesieczny wydarzenia={wydarzenia} />
      </CardContent>
    </Card>
  );
}
