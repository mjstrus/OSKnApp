import * as React from "react";
import { ExamSimulation, MediaPytania, tekstOpcji } from "./ExamSimulation";
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
  const [aktywne, setAktywne] = React.useState(false);
  const [wynik, setWynik] = React.useState<WynikPodejscia | null>(null);
  const [odpowiedzi, setOdpowiedzi] = React.useState<Record<string, string>>({});
  const [blad, setBlad] = React.useState<string | null>(null);

  async function start() {
    setBlad(null);
    setWynik(null);
    try {
      setPytania(await buildSimulation(kategoria));
      setAktywne(true);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function zakoncz(w: WynikPodejscia, odp: Record<string, string>) {
    setWynik(w);
    setOdpowiedzi(odp);
    setAktywne(false);
    try {
      await saveSimulation({ oskId, enrollmentId, pytania: pytania ?? [], odpowiedzi: odp, wynik: w });
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (aktywne && pytania) {
    return <ExamSimulation pytania={pytania} onFinish={zakoncz} />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
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

      {wynik && pytania && <PodsumowanieBledow pytania={pytania} odpowiedzi={odpowiedzi} />}
    </div>
  );
}

function PodsumowanieBledow({
  pytania,
  odpowiedzi,
}: {
  pytania: PytanieDB[];
  odpowiedzi: Record<string, string>;
}) {
  const bledne = pytania.filter((q) => odpowiedzi[q.id] !== q.poprawna);
  if (bledne.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Błędne odpowiedzi ({bledne.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bledne.map((q) => (
          <div key={q.id} className="border-b border-[var(--border)] pb-4 text-sm last:border-0">
            <p className="font-medium">{q.tresc}</p>
            {q.media_url && <MediaPytania url={q.media_url} />}
            <p className="text-[var(--destructive)]">
              Twoja odpowiedź: {odpowiedzi[q.id] ? tekstOpcji(q, odpowiedzi[q.id]!) : "brak odpowiedzi"}
            </p>
            <p className="text-green-600">Poprawna odpowiedź: {tekstOpcji(q, q.poprawna)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
