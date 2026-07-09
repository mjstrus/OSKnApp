import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KalendarzMiesieczny, type WydarzenieKalendarza } from "@/components/ui/calendar-month";
import { listTheorySessions, type TheorySessionRow } from "@/features/admin/api";

function naWydarzenie(s: TheorySessionRow): WydarzenieKalendarza {
  const start = new Date(s.start_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = new Date(s.end_ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const sala = s.room ? ` · ${s.room.nazwa}${s.room.adres ? `, ${s.room.adres}` : ""}` : "";
  return { data: start, etykieta: `${godzOd}–${godzDo}`, podetykieta: `${s.liczba_godzin}h${sala}` };
}

/** Grafik teorii kursu — tylko odczyt (RLS: każdy członek OSK widzi plan wykładów). */
export function TheorySchedule({ courseId }: { courseId: string }) {
  const [sesje, setSesje] = React.useState<TheorySessionRow[]>([]);

  React.useEffect(() => {
    void listTheorySessions(courseId).then(setSesje);
  }, [courseId]);

  if (sesje.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grafik teorii</CardTitle>
        <CardDescription>{sesje.length} bloków, {sesje.reduce((s, x) => s + x.liczba_godzin, 0)}h łącznie</CardDescription>
      </CardHeader>
      <CardContent>
        <KalendarzMiesieczny wydarzenia={sesje.map(naWydarzenie)} />
      </CardContent>
    </Card>
  );
}
