import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listGieldaQueue, resolveGieldaZgloszenie, type SlotGieldy } from "./api";

function formatujTermin(startTs: string, endTs: string): string {
  const start = new Date(startTs);
  const end = new Date(endTs);
  const dzien = start.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${dzien}, ${godzOd}–${godzDo}`;
}

/** Kolejka zgłoszeń do wolnych terminów z giełdy — admin wybiera kandydata. */
export function GieldaQueueSection({ courseId }: { courseId: string }) {
  const [sloty, setSloty] = React.useState<SlotGieldy[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setSloty(await listGieldaQueue(courseId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [courseId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function decyduj(zgloszenieId: string, decyzja: "zatwierdz" | "odrzuc") {
    setBusy(zgloszenieId);
    setBlad(null);
    try {
      await resolveGieldaZgloszenie(zgloszenieId, decyzja);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (sloty.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kolejka giełdy — kandydaci do zatwierdzenia</CardTitle>
        <CardDescription>Wybierz, komu przyznać wolny termin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        {sloty.map((s) => (
          <div key={s.slotId} className="rounded-md border border-[var(--border)] p-3">
            <p className="mb-2 text-sm font-medium">{formatujTermin(s.startTs, s.endTs)}</p>
            <div className="space-y-2">
              {s.kandydaci.map((k) => (
                <div
                  key={k.zgloszenieId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--muted)] px-3 py-2 text-sm"
                >
                  <span>
                    Kursant {k.enrollmentId.slice(0, 8)} — {k.godzinyOdbyte}h odbytych, {k.liczbaOdwolan}{" "}
                    odwołań ({k.liczbaNieusprawiedliwionych} nieusprawiedliwionych)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy === k.zgloszenieId}
                      onClick={() => decyduj(k.zgloszenieId, "zatwierdz")}
                    >
                      Zatwierdź
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === k.zgloszenieId}
                      onClick={() => decyduj(k.zgloszenieId, "odrzuc")}
                    >
                      Odrzuć
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
