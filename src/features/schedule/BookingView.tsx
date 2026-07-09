import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlotDoRezerwacji, SlotView } from "./types";

function fmt(ts: string): string {
  return new Date(ts).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

interface Props {
  clearedToDrive: boolean;
  dostepneSloty: SlotDoRezerwacji[];
  mojeSloty: SlotView[];
  onBook: (slot: SlotDoRezerwacji) => void;
  onCancel: (slot: SlotView) => void;
}

// Widok kursanta: rezerwacja i odwołanie jazd (R7). Gating R14b: bez „dopuszczony
// do jazd" nie pokazujemy ani listy wolnych slotów, ani rezerwacji.
export function BookingView({ clearedToDrive, dostepneSloty, mojeSloty, onBook, onCancel }: Props) {
  if (!clearedToDrive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Jazdy praktyczne</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)]" role="status">
            Rezerwacja jazd będzie dostępna po dopuszczeniu przez biuro OSK
            (status „dopuszczony do jazd").
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Wolne terminy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dostepneSloty.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Brak wolnych terminów.</p>
          )}
          {dostepneSloty.map((s) => (
            <div
              key={`${s.instructor_id}-${s.start_ts}`}
              className="flex items-center justify-between border-b border-[var(--border)] py-2"
            >
              <span className="text-sm">{fmt(s.start_ts)}</span>
              <Button size="sm" onClick={() => onBook(s)}>
                Zarezerwuj
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moje jazdy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mojeSloty.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border-b border-[var(--border)] py-2"
            >
              <span className="text-sm">
                {fmt(s.start_ts)} — {s.status}
              </span>
              {s.status === "zaplanowany" && (
                <Button size="sm" variant="outline" onClick={() => onCancel(s)}>
                  Odwołaj
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
