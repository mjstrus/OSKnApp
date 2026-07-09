import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PozycjaLeaderboard } from "@/engine/leaderboard";

interface Props {
  pozycje: PozycjaLeaderboard[];
  mojEnrollmentId?: string;
}

// Ranking kursu (R17), mobile-first. Własny wiersz podświetlony.
export function LeaderboardView({ pozycje, mojEnrollmentId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking kursu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {pozycje.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak wyników symulacji.</p>
        )}
        {pozycje.map((p) => {
          const moj = p.enrollmentId === mojEnrollmentId;
          return (
            <div
              key={p.enrollmentId}
              className={cn(
                "flex items-center justify-between rounded px-2 py-2 text-sm",
                moj && "bg-[var(--muted)] font-medium",
              )}
              data-testid={moj ? "moj-wiersz" : undefined}
            >
              <span>
                {p.pozycja}. {moj ? "Ty" : "Kursant"}
              </span>
              <span>
                {p.najlepszyWynik} pkt · {p.liczbaTestow} testów
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
