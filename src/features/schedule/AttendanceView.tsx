import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlotView } from "./types";

function fmt(ts: string): string {
  return new Date(ts).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  sloty: SlotView[];
  onConfirm: (slot: SlotView) => void;
  onFeedback?: (slot: SlotView, ocena: number, komentarz: string) => Promise<void>;
}

// Widok instruktora: potwierdzanie obecności (R9) — zamyka slot i dolicza godzinę.
// Przy odbytych jazdach opcjonalna prywatna ocena kursanta (R18, tylko admin czyta).
export function AttendanceView({ sloty, onConfirm, onFeedback }: Props) {
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
          <div key={s.id} className="border-b border-[var(--border)] py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{fmt(s.start_ts)}</span>
              {s.status === "zaplanowany" ? (
                <Button size="sm" onClick={() => onConfirm(s)}>
                  Potwierdź obecność
                </Button>
              ) : (
                <span className="text-sm text-[var(--muted-foreground)]">{s.status}</span>
              )}
            </div>
            {s.status === "odbyty" && onFeedback && <OcenaForm slot={s} onSubmit={onFeedback} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OcenaForm({
  slot,
  onSubmit,
}: {
  slot: SlotView;
  onSubmit: (slot: SlotView, ocena: number, komentarz: string) => Promise<void>;
}) {
  const [otwarte, setOtwarte] = React.useState(false);
  const [ocena, setOcena] = React.useState(3);
  const [komentarz, setKomentarz] = React.useState("");
  const [zapisano, setZapisano] = React.useState(false);
  const [blad, setBlad] = React.useState<string | null>(null);

  if (zapisano) {
    return <p className="mt-1 text-xs text-green-600">Ocena zapisana.</p>;
  }

  if (!otwarte) {
    return (
      <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOtwarte(true)}>
        Oceń kursanta
      </Button>
    );
  }

  async function zapisz() {
    setBlad(null);
    try {
      await onSubmit(slot, ocena, komentarz);
      setZapisano(true);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-md bg-[var(--muted)] p-2">
      <label className="flex items-center gap-2 text-sm">
        Ocena (1–5)
        <select
          value={ocena}
          onChange={(e) => setOcena(Number(e.target.value))}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <textarea
        value={komentarz}
        onChange={(e) => setKomentarz(e.target.value)}
        placeholder="Komentarz (widoczny tylko dla admina)"
        className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
        rows={2}
      />
      {blad && <p className="text-xs text-[var(--destructive)]">{blad}</p>}
      <Button size="sm" onClick={zapisz}>
        Zapisz ocenę
      </Button>
    </div>
  );
}
