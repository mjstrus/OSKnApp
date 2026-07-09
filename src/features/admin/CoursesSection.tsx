import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { zweryfikujPojemnoscKursu } from "@/engine/capacity";
import { CourseForm, type DaneKursu } from "./CourseForm";
import { fetchZasobyOsk, type KursRow } from "./api";

interface Props {
  oskId: string;
  kursy: KursRow[];
  onAdd: (d: DaneKursu) => void | Promise<void>;
}

export function CoursesSection({ oskId, kursy, onAdd }: Props) {
  const [ostrzezenia, setOstrzezenia] = React.useState<string[]>([]);
  const [szukaj, setSzukaj] = React.useState("");
  const widoczneKursy = szukaj
    ? kursy.filter((k) => k.nazwa.toLowerCase().includes(szukaj.toLowerCase()))
    : kursy;

  async function dodaj(d: DaneKursu) {
    setOstrzezenia([]);
    await onAdd(d);
    if (d.docelowy_czas_dni && d.max_uczestnicy) {
      try {
        const zasoby = await fetchZasobyOsk(oskId);
        const wynik = zweryfikujPojemnoscKursu(
          {
            hTeoria: d.h_teoria,
            hPraktyka: d.h_praktyka,
            maxUczestnicy: d.max_uczestnicy,
            docelowyCzasDni: d.docelowy_czas_dni,
          },
          zasoby,
        );
        if (!wynik.ok) setOstrzezenia(wynik.problemy);
      } catch {
        // Weryfikacja pojemności jest pomocnicza — brak danych o zasobach nie
        // blokuje utworzenia kursu.
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card id="nowy-kurs">
        <CardHeader>
          <CardTitle>Nowy kurs</CardTitle>
          <CardDescription>
            Profil godzinowy, termin i limity zapisów (R2). Przy podaniu docelowego czasu
            realizacji i maks. liczby uczestników sprawdzimy, czy sale/auta/instruktorzy dają radę.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm onSubmit={dodaj} />
          {ostrzezenia.length > 0 && (
            <div className="mt-4 space-y-1 rounded-md border border-[var(--destructive)] p-3">
              <p className="text-sm font-medium text-[var(--destructive)]">
                Kurs dodany, ale zasoby OSK mogą nie wystarczyć na zadany termin:
              </p>
              <ul className="list-disc pl-5 text-sm text-[var(--destructive)]">
                {ostrzezenia.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Kursy</h2>
          <input
            type="search"
            id="szukaj-kursu"
            placeholder="Szukaj kursu…"
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            className="w-56 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
        </div>
        {widoczneKursy.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">
            {szukaj ? "Brak kursów pasujących do wyszukiwania." : "Brak kursów."}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widoczneKursy.map((k) => (
            <Link key={k.id} to={`/panel/kursy/${k.id}`} className="block">
              <Card className="h-full transition-colors hover:bg-[var(--muted)]">
                <CardHeader>
                  <CardTitle className="text-base">{k.nazwa}</CardTitle>
                  <CardDescription>
                    {k.data_poczatku ? `Start: ${k.data_poczatku}` : "Termin nieustalony"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-[var(--muted-foreground)]">
                  {k.h_teoria}h teorii / {k.h_praktyka}h praktyki
                  <br />
                  <span className={cn(k.zapisy_otwarte ? "text-green-600" : "text-[var(--muted-foreground)]")}>
                    {k.zapisy_otwarte ? "Zapisy otwarte" : "Zapisy zamknięte"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
