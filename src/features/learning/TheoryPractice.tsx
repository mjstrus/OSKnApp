import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaPytania, OPCJE_PODSTAWOWE, OPCJE_SPECJALISTYCZNE, tekstOpcji } from "./ExamSimulation";
import { fetchQuestionBank, savePractice, type PytanieDB } from "./api";

interface Props {
  oskId: string;
  enrollmentId: string;
  kategoria: string;
}

/** Tryb nauki: bez limitu czasu, cały bank pytań kategorii, natychmiastowy feedback po odpowiedzi. */
export function TheoryPractice({ oskId, enrollmentId, kategoria }: Props) {
  const [pytania, setPytania] = React.useState<PytanieDB[] | null>(null);
  const [odpowiedzi, setOdpowiedzi] = React.useState<Record<string, string>>({});
  const [blad, setBlad] = React.useState<string | null>(null);
  const [zapisano, setZapisano] = React.useState(false);

  async function start() {
    setBlad(null);
    setOdpowiedzi({});
    setZapisano(false);
    try {
      setPytania(await fetchQuestionBank(kategoria));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function zakoncz() {
    if (!pytania) return;
    setBlad(null);
    try {
      await savePractice({ oskId, enrollmentId, pytania, odpowiedzi });
      setZapisano(true);
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
              {q.media_url && <MediaPytania url={q.media_url} />}
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
                      {tekstOpcji(q, o)}
                    </span>
                  </label>
                ))}
              </fieldset>
              {wybrana && (
                <p className={cn("mt-2 text-sm", wybrana === q.poprawna ? "text-green-600" : "text-[var(--destructive)]")}>
                  {wybrana === q.poprawna
                    ? "Poprawnie."
                    : `Błędnie — poprawna odpowiedź: ${tekstOpcji(q, q.poprawna)}.`}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <Button onClick={zakoncz}>Zakończ i zapisz postęp</Button>
          {zapisano && <span className="text-sm text-green-600">Zapisano.</span>}
          {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
