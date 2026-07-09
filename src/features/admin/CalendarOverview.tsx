import * as React from "react";
import { KalendarzPrzelaczany, type WydarzenieKalendarza } from "@/components/ui/calendar-month";
import { listAllTheorySessions, type TheorySessionZKursem } from "./api";

function naWydarzenie(s: TheorySessionZKursem): WydarzenieKalendarza {
  const start = new Date(s.start_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = new Date(s.end_ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return {
    data: start,
    etykieta: `${godzOd}–${godzDo}`,
    podetykieta: s.course?.nazwa ?? undefined,
  };
}

/** Centralny widok admina: grafik teorii wszystkich kursów OSK, miesiąc/tydzień. */
export function CalendarOverview({ oskId }: { oskId: string }) {
  const [sesje, setSesje] = React.useState<TheorySessionZKursem[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  React.useEffect(() => {
    listAllTheorySessions(oskId)
      .then(setSesje)
      .catch((e) => setBlad((e as Error).message));
  }, [oskId]);

  if (blad) return <p className="text-sm text-[var(--destructive)]">{blad}</p>;

  return (
    <div
      className="min-h-[24rem] min-w-[20rem] resize overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
      style={{ width: "100%", height: "70vh" }}
    >
      <KalendarzPrzelaczany wydarzenia={sesje.map(naWydarzenie)} />
    </div>
  );
}
