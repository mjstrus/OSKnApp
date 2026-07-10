import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InstructorRequestRow } from "./api";

const TYP_LABEL: Record<string, string> = {
  urlop: "Urlop / niedyspozycyjność",
  problem: "Problem / usterka",
  zmiana_grafiku: "Prośba o zmianę grafiku",
  inne: "Inne",
};

/** Historia własnych zgłoszeń do admina — widać status (pending/rozpatrzone). */
export function InstructorRequestHistory({ zgloszenia }: { zgloszenia: InstructorRequestRow[] }) {
  if (zgloszenia.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moje zgłoszenia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {zgloszenia.map((z) => (
          <div key={z.id} className="border-b border-[var(--border)] py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{TYP_LABEL[z.typ] ?? z.typ}</span>
              <span
                className={z.status === "rozpatrzone" ? "text-green-600" : "text-[var(--muted-foreground)]"}
              >
                {z.status === "rozpatrzone" ? "Rozpatrzone" : "Oczekuje"}
              </span>
            </div>
            <p className="text-[var(--muted-foreground)]">{z.tresc}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
