import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAuditLog, type AuditLogRow } from "./api";

const AKCJA_LABEL: Record<string, string> = {
  zatwierdzenie_zgloszenia: "Zatwierdzenie zgłoszenia",
  usuniecie_instruktora: "Usunięcie instruktora",
  zmiana_platnosci: "Zmiana statusu płatności",
  zmiana_dopuszczenia_do_jazd: "Zmiana dopuszczenia do jazd",
  rozstrzygniecie_gieldy: "Rozstrzygnięcie giełdy",
  zamkniecie_zapisow: "Zamknięcie zapisów",
  edycja_slotu: "Ręczna edycja slotu",
  usuniecie_slotu: "Usunięcie slotu",
};

/** Audit log akcji admina — kto/kiedy zatwierdził/usunął, do sporów z klientem. */
export function AdminAuditLogSection({ oskId }: { oskId: string }) {
  const [wpisy, setWpisy] = React.useState<AuditLogRow[]>([]);

  React.useEffect(() => {
    void listAuditLog(oskId).then(setWpisy);
  }, [oskId]);

  if (wpisy.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log akcji admina</CardTitle>
        <CardDescription>Ostatnie 50 akcji — kto i kiedy zatwierdził/usunął.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {wpisy.map((w) => (
          <div key={w.id} className="border-b border-[var(--border)] py-1 text-xs">
            <span className="text-[var(--muted-foreground)]">
              {new Date(w.created_at).toLocaleString("pl-PL")} ·{" "}
            </span>
            <span className="font-medium">{AKCJA_LABEL[w.akcja] ?? w.akcja}</span>
            {w.szczegoly && (
              <span className="text-[var(--muted-foreground)]"> — {JSON.stringify(w.szczegoly)}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
