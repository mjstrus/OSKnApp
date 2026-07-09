import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  claimGieldaSlot,
  getMyProposals,
  listGielda,
  listMyGieldaZgloszenia,
  respondToProposal,
  type OfertaGieldy,
  type PropozycjaJazdy,
} from "./api";

function formatujTermin(startTs: string, endTs: string): string {
  const start = new Date(startTs);
  const end = new Date(endTs);
  const dzien = start.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${dzien}, ${godzOd}–${godzDo}`;
}

interface Props {
  enrollmentId: string;
  courseId: string;
}

/**
 * Propozycje jazd (auto-przydzielone, do potwierdzenia w oknie czasowym) i
 * giełda wolnych terminów (odwołane/przeterminowane propozycje — każdy
 * zapisany na kurs kursant może je zarezerwować).
 */
export function PracticeSchedule({ enrollmentId, courseId }: Props) {
  const [propozycje, setPropozycje] = React.useState<PropozycjaJazdy[]>([]);
  const [gielda, setGielda] = React.useState<OfertaGieldy[]>([]);
  const [zgloszoneSloty, setZgloszoneSloty] = React.useState<string[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      const [p, g, z] = await Promise.all([
        getMyProposals(enrollmentId),
        listGielda(courseId),
        listMyGieldaZgloszenia(enrollmentId),
      ]);
      setPropozycje(p);
      setGielda(g);
      setZgloszoneSloty(z);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [enrollmentId, courseId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function odpowiedz(slotId: string, action: "potwierdz" | "odwolaj") {
    setBlad(null);
    try {
      await respondToProposal(slotId, action);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function zarezerwuj(slotId: string) {
    setBlad(null);
    try {
      await claimGieldaSlot(slotId);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (propozycje.length === 0 && gielda.length === 0 && !blad) return null;

  return (
    <div className="space-y-4">
      {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

      {propozycje.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Propozycje jazd</CardTitle>
            <CardDescription>Auto-przydzielone terminy — potwierdź lub odwołaj do terminu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {propozycje.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--muted)] px-3 py-2 text-sm"
              >
                <div>
                  <div>{formatujTermin(p.start_ts, p.end_ts)}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Potwierdź do {new Date(p.confirm_by).toLocaleString("pl-PL")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => odpowiedz(p.id, "potwierdz")}>
                    Potwierdź
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => odpowiedz(p.id, "odwolaj")}>
                    Odwołaj
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {gielda.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Giełda wolnych terminów</CardTitle>
            <CardDescription>
              Terminy zwolnione przez innych kursantów — zgłoś się, admin wybiera kandydata.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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
