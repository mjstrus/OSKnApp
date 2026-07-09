import * as React from "react";
import { EGZAMIN_WORD_B, ocenPodejscie, type KonfiguracjaEgzaminu, type Pytanie, type WynikPodejscia } from "@/engine/exam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  pytania: Pytanie[];
  config?: KonfiguracjaEgzaminu;
  onFinish: (wynik: WynikPodejscia, odpowiedzi: Record<string, string>) => void;
}

const OPCJE_PODSTAWOWE = ["TAK", "NIE"];
const OPCJE_SPECJALISTYCZNE = ["A", "B", "C"];

function mmss(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Symulacja egzaminu WORD (R16): odwzorowuje limit czasu i punktację silnika.
export function ExamSimulation({ pytania, config = EGZAMIN_WORD_B, onFinish }: Props) {
  const [odpowiedzi, setOdpowiedzi] = React.useState<Record<string, string>>({});
  const [pozostalo, setPozostalo] = React.useState(config.czasSekundy);
  const zakonczono = React.useRef(false);

  const zakoncz = React.useCallback(() => {
    if (zakonczono.current) return;
    zakonczono.current = true;
    setOdpowiedzi((biezace) => {
      onFinish(ocenPodejscie(pytania, biezace, config), biezace);
      return biezace;
    });
  }, [pytania, config, onFinish]);

  React.useEffect(() => {
    const t = setInterval(() => {
      setPozostalo((s) => {
        if (s <= 1) {
          clearInterval(t);
          zakoncz(); // limit czasu wymusza zakończenie
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [zakoncz]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <div className="sticky top-0 flex justify-between bg-[var(--background)] py-2 text-sm font-medium">
        <span>Symulacja egzaminu</span>
        <span data-testid="timer" aria-label="Pozostały czas">
          {mmss(pozostalo)}
        </span>
      </div>

      {pytania.map((q, i) => {
        const opcje = q.typ === "podstawowe" ? OPCJE_PODSTAWOWE : OPCJE_SPECJALISTYCZNE;
        return (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {(q as Pytanie & { tresc?: string }).tresc ?? `Pytanie ${i + 1}`}
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
                      checked={odpowiedzi[q.id] === o}
                      onChange={() => setOdpowiedzi((prev) => ({ ...prev, [q.id]: o }))}
                    />
                    {o}
                  </label>
                ))}
              </fieldset>
            </CardContent>
          </Card>
        );
      })}

      <Button className="w-full" onClick={zakoncz}>
        Zakończ i sprawdź
      </Button>
    </div>
  );
}
