import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OPCJE_PODSTAWOWE, OPCJE_SPECJALISTYCZNE } from "./ExamSimulation";
import { fetchQuestionBank, type PytanieDB } from "./api";

/** Tryb nauki: bez limitu czasu, cały bank pytań kategorii, natychmiastowy feedback po odpowiedzi. */
export function TheoryPractice({ kategoria }: { kategoria: string }) {
  const [pytania, setPytania] = React.useState<PytanieDB[] | null>(null);
  const [odpowiedzi, setOdpowiedzi] = React.useState<Record<string, string>>({});
  const [blad, setBlad] = React.useState<string | null>(null);

  async function start() {
    setBlad(null);
    setOdpowiedzi({});
    try {
      setPytania(await fetchQuestionBank(kategoria));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (!pytania) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teoria — tryb nauki</CardTitle>
          <CardDescription>Cały bank pytań kat. {kategoria}, bez limitu czasu, od razu widać poprawną odpowiedź.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
          <Button onClick={start}>Rozpocznij naukę</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pytania.map((q, i) => {
        const opcje = q.typ === "podstawowe" ? OPCJE_PODSTAWOWE : OPCJE_SPECJALISTYCZNE;
        const wybrana = odpowiedzi[q.id];
        return (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {q.tresc}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset className="space-y-1">
                {opcje.map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      value={o}
                      checked={wybrana === o}
                      onChange={() => setOdpowiedzi((prev) => ({ ...prev, [q.id]: o }))}
                    />
                    <span
                      className={cn(
                        wybrana && o === q.poprawna && "font-medium text-green-600",
                        wybrana === o && o !== q.poprawna && "font-medium text-[var(--destructive)]",
                      )}
                    >
                      {o}
                    </span>
                  </label>
                ))}
              </fieldset>
              {wybrana && (
                <p className={cn("mt-2 text-sm", wybrana === q.poprawna ? "text-green-600" : "text-[var(--destructive)]")}>
                  {wybrana === q.poprawna ? "Poprawnie." : `Błędnie — poprawna odpowiedź: ${q.poprawna}.`}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
