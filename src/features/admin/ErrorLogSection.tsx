import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listErrorLog, type ErrorLogRow } from "./api";

/** Log błędów frontendu (zamiast Sentry) — admin widzi, zanim klient zadzwoni. */
export function ErrorLogSection({ oskId }: { oskId: string }) {
  const [wpisy, setWpisy] = React.useState<ErrorLogRow[]>([]);

  React.useEffect(() => {
    void listErrorLog(oskId).then(setWpisy);
  }, [oskId]);

  if (wpisy.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log błędów</CardTitle>
        <CardDescription>Ostatnie 50 błędów po stronie przeglądarki.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {wpisy.map((w) => (
          <div key={w.id} className="border-b border-[var(--border)] py-1 text-xs">
            <span className="text-[var(--muted-foreground)]">
              {new Date(w.created_at).toLocaleString("pl-PL")} · {w.kontekst}
            </span>
            <div>{w.wiadomosc}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
