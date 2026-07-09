import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HoursProgress } from "@/features/progress/HoursProgress";
import { TheoryProgress } from "@/features/progress/TheoryProgress";
import { getCourse, listTheorySessions } from "@/features/admin/api";
import { listGielda } from "./api";
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
      <TerminZakonczeniaWidget ctx={ctx} />
      <PraktykaProgressWidget ctx={ctx} />
    </div>
  );
}

function PraktykaProgressWidget({ ctx }: { ctx: KursantContext }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <HoursProgress stan={ctx.stan} />
      </CardContent>
    </Card>
  );
}

/**
 * Szacowany termin zakończenia — projekcja liniowa z realnego tempa (godziny
 * zrobione / dni od startu), nie ze sztywnego docelowy_czas_dni. Rośnie/maleje
 * z frekwencją, tak jak prosił user. Za mało danych na start → fallback albo
 * "za wcześnie".
 */
function TerminZakonczeniaWidget({ ctx }: { ctx: KursantContext }) {
  const [tekst, setTekst] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const [kurs, sesje] = await Promise.all([
        getCourse(ctx.courseId),
        listTheorySessions(ctx.courseId),
      ]);
      if (!kurs?.data_poczatku) return setTekst("Brak danych do oszacowania");

      const start = new Date(kurs.data_poczatku).getTime();
      const dniOdStartu = (Date.now() - start) / 86_400_000;
      const teoriaOdbyta = sesje
        .filter((s) => new Date(s.end_ts).getTime() < Date.now())
        .reduce((s, x) => s + x.liczba_godzin, 0);
      const zrobione = teoriaOdbyta + ctx.stan.potwierdzone;
      const cel = kurs.h_teoria + kurs.h_praktyka;

      if (dniOdStartu <= 0 || zrobione <= 0) {
        return setTekst(
          kurs.docelowy_czas_dni
            ? new Date(start + kurs.docelowy_czas_dni * 86_400_000).toLocaleDateString("pl-PL")
            : "Za wcześnie by oszacować",
        );
      }
      const tempoGodzDzien = zrobione / dniOdStartu;
      const pozostaleDni = Math.max(0, (cel - zrobione) / tempoGodzDzien);
      setTekst(new Date(Date.now() + pozostaleDni * 86_400_000).toLocaleDateString("pl-PL"));
    })();
  }, [ctx.courseId, ctx.stan.potwierdzone]);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Szacowany termin zakończenia</CardDescription>
        <CardTitle className="text-sm font-medium">{tekst ?? "…"}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-[var(--muted-foreground)]">
        Estymacja z dotychczasowego tempa — zmienia się z frekwencją.
      </CardContent>
    </Card>
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
      <GieldaWidget courseId={ctx.courseId} />
      <TeoriaProgressWidget ctx={ctx} />
    </div>
  );
}

function GieldaWidget({ courseId }: { courseId: string }) {
  const [liczba, setLiczba] = React.useState<number | null>(null);

  React.useEffect(() => {
    void listGielda(courseId).then((g) => setLiczba(g.length));
  }, [courseId]);

  return (
    <Link to="/panel/gielda" className="block">
      <Card className={cn("transition-colors hover:bg-[var(--muted)]", liczba && liczba > 0 && "border-[var(--destructive)]")}>
        <CardHeader>
          <CardDescription>Nowe terminy na giełdzie</CardDescription>
          <CardTitle className={cn("text-2xl", liczba && liczba > 0 && "text-[var(--destructive)]")}>
            {liczba ?? "…"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-[var(--muted-foreground)]">
          {liczba && liczba > 0 ? "Jest coś do wzięcia" : "Brak wolnych terminów"}
        </CardContent>
      </Card>
    </Link>
  );
}

function TeoriaProgressWidget({ ctx }: { ctx: KursantContext }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <TheoryProgress courseId={ctx.courseId} />
      </CardContent>
    </Card>
  );
}
