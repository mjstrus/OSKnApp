import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listWorkingHours } from "@/features/admin/api";
import type { SlotView } from "./types";

const DNI = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

/** Godziny pracy ustawione przez admina — instruktor tylko podgląd. */
export function InstructorWidgetLeft({ instructorId }: { instructorId: string | null }) {
  const [godziny, setGodziny] = React.useState<{ dzien_tygodnia: number; od_godz: string; do_godz: string }[]>([]);

  React.useEffect(() => {
    if (!instructorId) return;
    void listWorkingHours(instructorId).then(setGodziny);
  }, [instructorId]);

  return (
    <div className="hidden w-64 shrink-0 space-y-4 p-4 lg:block">
      <Card>
        <CardHeader>
          <CardDescription>Godziny pracy</CardDescription>
          <CardTitle className="text-sm font-medium">Ustawione przez OSK</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-[var(--muted-foreground)]">
          {godziny.length === 0 && <p>Brak ustawionych godzin.</p>}
          {godziny.map((g) => (
            <div key={`${g.dzien_tygodnia}-${g.od_godz}`}>
              {DNI[g.dzien_tygodnia]} {g.od_godz.slice(0, 5)}–{g.do_godz.slice(0, 5)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function InstructorWidgetRight({ sloty }: { sloty: SlotView[] }) {
  const najblizsza = sloty
    .filter((s) => s.status === "zaplanowany" && new Date(s.start_ts).getTime() > Date.now())
    .sort((a, b) => a.start_ts.localeCompare(b.start_ts))[0];

  return (
    <div className="hidden w-64 shrink-0 space-y-4 p-4 lg:block">
      <Card>
        <CardHeader>
          <CardDescription>Najbliższa jazda</CardDescription>
          <CardTitle className="text-sm font-medium">
            {najblizsza
              ? new Date(najblizsza.start_ts).toLocaleString("pl-PL", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Brak zaplanowanej"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
