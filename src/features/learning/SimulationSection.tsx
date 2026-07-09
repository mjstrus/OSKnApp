import * as React from "react";
import { ExamSimulation } from "./ExamSimulation";
import { buildSimulation, saveSimulation, type PytanieDB } from "./api";
import type { WynikPodejscia } from "@/engine/exam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  oskId: string;
  enrollmentId: string;
  kategoria: string;
}

export function SimulationSection({ oskId, enrollmentId, kategoria }: Props) {
  const [pytania, setPytania] = React.useState<PytanieDB[] | null>(null);
  const [wynik, setWynik] = React.useState<WynikPodejscia | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  async function start() {
    setBlad(null);
    setWynik(null);
    try {
      setPytania(await buildSimulation(kategoria));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function zakoncz(w: WynikPodejscia, odpowiedzi: Record<string, string>) {
    setWynik(w);
    setPytania(null);
    try {
      await saveSimulation({ oskId, enrollmentId, pytania: pytania ?? [], odpowiedzi, wynik: w });
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (pytania) {
    return <ExamSimulation pytania={pytania} onFinish={zakoncz} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Symulacja egzaminu</CardTitle>
        <CardDescription>32 pytania, 25 minut, próg 68/74 (kat. {kategoria}).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {wynik && (
          <p className="text-sm font-medium">
            Wynik: {wynik.punkty}/{wynik.maxPkt} —{" "}
            {wynik.zaliczony ? (
              <span className="text-green-600">zaliczony</span>
            ) : (
              <span className="text-[var(--destructive)]">niezaliczony</span>
            )}
          </p>
        )}
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        <Button onClick={start}>{wynik ? "Spróbuj ponownie" : "Rozpocznij symulację"}</Button>
      </CardContent>
    </Card>
  );
}
