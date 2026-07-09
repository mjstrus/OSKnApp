import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface ScoringInstruktora {
  instructorId: string;
  etykieta: string;
  srednia: number;
  liczba: number;
}

// Prywatny scoring instruktora (R18) — widok wyłącznie dla admina; RLS
// (0005) i tak odcina odczyt innym rolom.
export function InstructorScoring({ pozycje }: { pozycje: ScoringInstruktora[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring instruktorów (prywatny)</CardTitle>
        <CardDescription>Widoczne tylko dla admina OSK.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {pozycje.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak ocen.</p>
        )}
        {pozycje.map((p) => (
          <div
            key={p.instructorId}
            className="flex items-center justify-between border-b border-[var(--border)] py-2 text-sm"
          >
            <span>{p.etykieta}</span>
            <span>
              średnia {p.srednia.toFixed(1)} ({p.liczba} ocen)
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
