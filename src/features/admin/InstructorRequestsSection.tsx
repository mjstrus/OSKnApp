import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listInstructorRequests, resolveInstructorRequest, type InstructorRequestRow } from "./api";

const TYP_LABEL: Record<string, string> = {
  urlop: "Urlop / niedyspozycyjność",
  problem: "Problem / usterka",
  zmiana_grafiku: "Prośba o zmianę grafiku",
  inne: "Inne",
};

export function InstructorRequestsSection({ oskId }: { oskId: string }) {
  const [zgloszenia, setZgloszenia] = React.useState<InstructorRequestRow[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setZgloszenia(await listInstructorRequests(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function rozpatrz(id: string) {
    try {
      await resolveInstructorRequest(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  const oczekujace = zgloszenia.filter((z) => z.status === "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zgłoszenia od instruktorów</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        {oczekujace.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak oczekujących zgłoszeń.</p>
        )}
        {oczekujace.map((z) => (
          <div key={z.id} className="border-b border-[var(--border)] py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{TYP_LABEL[z.typ] ?? z.typ}</span>
              <Button size="sm" onClick={() => rozpatrz(z.id)}>
                Oznacz jako rozpatrzone
              </Button>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{z.tresc}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
