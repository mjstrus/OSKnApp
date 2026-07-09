import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlotView } from "./types";

function fmt(ts: string): string {
  return new Date(ts).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  sloty: SlotView[];
  onConfirm: (slot: SlotView) => void;
}

// Widok instruktora: potwierdzanie obecności (R9) — zamyka slot i dolicza godzinę.
export function AttendanceView({ sloty, onConfirm }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moje jazdy — obecność</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sloty.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak zaplanowanych jazd.</p>
        )}
        {sloty.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between border-b border-[var(--border)] py-2"
          >
            <span className="text-sm">{fmt(s.start_ts)}</span>
            {s.status === "zaplanowany" ? (
              <Button size="sm" onClick={() => onConfirm(s)}>
                Potwierdź obecność
              </Button>
            ) : (
              <span className="text-sm text-[var(--muted-foreground)]">{s.status}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
