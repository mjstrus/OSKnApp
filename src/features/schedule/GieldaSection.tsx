import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KalendarzMiesieczny, type WydarzenieKalendarza } from "@/components/ui/calendar-month";
import {
  claimGieldaSlot,
  listGielda,
  listMyGieldaZgloszenia,
  type OfertaGieldy,
} from "./api";

function formatujTermin(startTs: string, endTs: string): string {
  const start = new Date(startTs);
  const end = new Date(endTs);
  const dzien = start.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${dzien}, ${godzOd}–${godzDo}`;
}

function naWydarzenie(g: OfertaGieldy, zgloszony: boolean): WydarzenieKalendarza {
  const start = new Date(g.start_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = new Date(g.end_ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return { data: start, etykieta: `${godzOd}–${godzDo}`, kolor: zgloszony ? "sukces" : "domyslny" };
}

/** Giełda wolnych terminów jazd — odwołane/przeterminowane propozycje, zapisani na kurs się zgłaszają. */
export function GieldaSection({ courseId, enrollmentId }: { courseId: string; enrollmentId: string }) {
  const [gielda, setGielda] = React.useState<OfertaGieldy[]>([]);
  const [zgloszoneSloty, setZgloszoneSloty] = React.useState<string[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      const [g, z] = await Promise.all([listGielda(courseId), listMyGieldaZgloszenia(enrollmentId)]);
      setGielda(g);
      setZgloszoneSloty(z);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [courseId, enrollmentId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function zarezerwuj(slotId: string) {
    setBlad(null);
    try {
      await claimGieldaSlot(slotId);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Giełda wolnych terminów</CardTitle>
          <CardDescription>
            Terminy zwolnione przez innych kursantów — zgłoś się, admin wybiera kandydata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gielda.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Brak wolnych terminów.</p>
          ) : (
            <KalendarzMiesieczny
              wydarzenia={gielda.map((g) => naWydarzenie(g, zgloszoneSloty.includes(g.id)))}
            />
          )}
        </CardContent>
      </Card>

      {gielda.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            {gielda.map((g) => {
              const zgloszony = zgloszoneSloty.includes(g.id);
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded bg-[var(--muted)] px-3 py-2 text-sm"
                >
                  <span>{formatujTermin(g.start_ts, g.end_ts)}</span>
                  {zgloszony ? (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Zgłoszenie wysłane, czeka na admina
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => zarezerwuj(g.id)}>
                      Zgłoś się
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
