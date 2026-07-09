import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listEnrollments,
  setClearedToDrive,
  updatePayment,
  type EnrollmentRow,
  type KursRow,
} from "./api";

const PLATNOSCI: { wartosc: EnrollmentRow["payment_status"]; label: string }[] = [
  { wartosc: "nieoplacony", label: "Nieopłacony" },
  { wartosc: "czesciowo", label: "Częściowo" },
  { wartosc: "oplacony", label: "Opłacony" },
] as { wartosc: EnrollmentRow["payment_status"]; label: string }[];

export function EnrollmentsSection({ kursy }: { kursy: KursRow[] }) {
  const [courseId, setCourseId] = React.useState(kursy[0]?.id ?? "");
  const [zapisy, setZapisy] = React.useState<EnrollmentRow[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    if (!courseId) return;
    try {
      setZapisy(await listEnrollments(courseId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [courseId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  if (kursy.length === 0) {
    return <p className="p-2 text-sm text-[var(--muted-foreground)]">Najpierw dodaj kurs.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kursanci</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          aria-label="Wybierz kurs"
          className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {kursy.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nazwa}
            </option>
          ))}
        </select>

        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        {zapisy.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak kursantów na tym kursie.</p>
        )}

        {zapisy.map((z) => (
          <div
            key={z.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-2 text-sm"
          >
            <span>Kursant {z.membership_id.slice(0, 8)}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={z.cleared_to_drive}
                  onChange={async (e) => {
                    await setClearedToDrive(z.id, e.target.checked);
                    await odswiez();
                  }}
                />
                dopuszczony do jazd
              </label>
              <select
                aria-label="Status płatności"
                className="h-9 rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"
                value={z.payment_status}
                onChange={async (e) => {
                  await updatePayment(
                    z.id,
                    e.target.value as "nieoplacony" | "czesciowo" | "oplacony",
                  );
                  await odswiez();
                }}
              >
                {PLATNOSCI.map((p) => (
                  <option key={p.wartosc} value={p.wartosc}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => void odswiez()}>
          Odśwież
        </Button>
      </CardContent>
    </Card>
  );
}
