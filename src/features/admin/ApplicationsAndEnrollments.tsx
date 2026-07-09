import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollmentsSection } from "./EnrollmentsSection";
import type { KursRow, ZgloszenieRow } from "./api";

interface Props {
  zgloszenia: ZgloszenieRow[];
  kursy: KursRow[];
  onApprove: (id: string) => void | Promise<void>;
}

export function ApplicationsAndEnrollments({ zgloszenia, kursy, onApprove }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zgłoszenia do zatwierdzenia (maker-checker)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {zgloszenia.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Brak oczekujących zgłoszeń.</p>
          )}
          {zgloszenia.map((z) => (
            <div
              key={z.id}
              className="flex items-center justify-between border-b border-[var(--border)] py-2"
            >
              <span className="text-sm">
                {z.imie} {z.nazwisko} — {z.email}
              </span>
              <Button size="sm" onClick={() => onApprove(z.id)}>
                Zatwierdź
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <EnrollmentsSection kursy={kursy} />
    </div>
  );
}
