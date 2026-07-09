import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { KursantContext } from "./api";

// Statyczne widgety boczne kursanta — dane już wczytane w ctx, zero dodatkowych
// zapytań. Bez katalogu/drag-drop jak u admina: jeden kursant, stały zestaw.
export function KursantWidgetLeft({ ctx }: { ctx: KursantContext }) {
  return (
    <div className="hidden w-64 shrink-0 space-y-4 p-4 lg:block">
      <Card>
        <CardHeader>
          <CardDescription>Twój kurs</CardDescription>
          <CardTitle className="text-2xl">Kat. {ctx.kategoria}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          {ctx.clearedToDrive ? "Dopuszczony do jazd" : "Jeszcze nie dopuszczony do jazd"}
        </CardContent>
      </Card>
    </div>
  );
}

export function KursantWidgetRight({ ctx }: { ctx: KursantContext }) {
  const najblizsza = ctx.mojeSloty
    .filter((s) => s.status === "zaplanowany" && new Date(s.start_ts).getTime() > Date.now())
    .sort((a, b) => a.start_ts.localeCompare(b.start_ts))[0];

  return (
    <div className="hidden w-64 shrink-0 space-y-4 p-4 lg:block">
      <Card>
        <CardHeader>
          <CardDescription>Najbliższa jazda</CardDescription>
          <CardTitle className="text-sm font-medium">
            {najblizsza
              ? new Date(najblizsza.start_ts).toLocaleString("pl-PL", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Brak zaplanowanej"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
