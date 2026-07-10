import * as React from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell } from "@/app/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KalendarzMiesieczny, type WydarzenieKalendarza } from "@/components/ui/calendar-month";
import { getInstructorTheorySessions, getMyInstructorId } from "./api";
import type { TheorySessionZKursem } from "@/features/admin/api";

function naWydarzenie(s: TheorySessionZKursem): WydarzenieKalendarza {
  const start = new Date(s.start_ts);
  const godzOd = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const godzDo = new Date(s.end_ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const sala = s.room ? ` · ${s.room.nazwa}` : "";
  return { data: start, etykieta: `${godzOd}–${godzDo}`, podetykieta: `${s.course?.nazwa ?? "Kurs"}${sala}` };
}

/** Panel wykładowcy — grafik wykładów kursów, do których jest przypisany. */
export function WykladowcaPanel() {
  const { oskId } = useAuth();
  const [sesje, setSesje] = React.useState<TheorySessionZKursem[] | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!oskId) return;
    void (async () => {
      try {
        const id = await getMyInstructorId(oskId);
        setSesje(id ? await getInstructorTheorySessions(id) : []);
      } catch (e) {
        setBlad((e as Error).message);
      }
    })();
  }, [oskId]);

  return (
    <AppShell navItems={[]}>
      <div className="mx-auto max-w-2xl space-y-4">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        <Card>
          <CardHeader>
            <CardTitle>Grafik wykładów</CardTitle>
            <CardDescription>
              {sesje ? `${sesje.length} zaplanowanych bloków` : "Ładowanie…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sesje && sesje.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Brak przypisanych kursów.</p>
            )}
            {sesje && sesje.length > 0 && <KalendarzMiesieczny wydarzenia={sesje.map(naWydarzenie)} />}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
