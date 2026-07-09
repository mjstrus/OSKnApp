import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProposals, respondToProposal, type PropozycjaJazdy } from "./api";

function formatujTermin(startTs: string, endTs: string): string {
  const start = new Date(startTs);
  const end = new Date(endTs);
  const dzien = start.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${dzien}, ${godzOd}–${godzDo}`;
}

/** Propozycje jazd auto-przydzielone — do potwierdzenia w oknie czasowym. Giełda ma własną zakładkę. */
export function PracticeSchedule({ enrollmentId }: { enrollmentId: string }) {
  const [propozycje, setPropozycje] = React.useState<PropozycjaJazdy[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setPropozycje(await getMyProposals(enrollmentId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [enrollmentId]);

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

  if (propozycje.length === 0 && !blad) return null;

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
    </div>
  );
}
