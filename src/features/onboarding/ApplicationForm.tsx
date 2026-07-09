import * as React from "react";
import { czyNiepelnoletni, walidujZgloszenie, type DaneZgloszenia } from "@/engine/onboarding";
import { rozwinDostepnosc, submitApplication, type SubmitPayload, type WynikSubmit } from "./submitApplication";
import { WorkingHoursForm, type DaneGodzinBulk } from "@/features/admin/WorkingHoursForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  courseId: string;
  /** Wstrzykiwalny submit (testy); domyślnie realny Edge Function. */
  onSubmit?: (p: SubmitPayload) => Promise<WynikSubmit>;
}

const PUSTY = {
  imie: "",
  nazwisko: "",
  email: "",
  telefon: "",
  kategoria: "B",
  pkkNumber: "",
  dataUrodzenia: "",
  zgodaRodo: false,
  zgodaOpiekuna: false,
};

export function ApplicationForm({ courseId, onSubmit = submitApplication }: Props) {
  const [f, setF] = React.useState(PUSTY);
  const [braki, setBraki] = React.useState<string[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [sukces, setSukces] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [dostepnosc, setDostepnosc] = React.useState<DaneGodzinBulk[]>([]);

  // Zgoda opiekuna pokazywana tylko dla niepełnoletnich (na podstawie daty urodzenia).
  const niepelnoletni = f.dataUrodzenia ? czyNiepelnoletni(f.dataUrodzenia) : false;

  const set = (k: keyof typeof PUSTY) => (v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }));

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    const dane: DaneZgloszenia = { ...f };
    const wynik = walidujZgloszenie(dane);
    if (!wynik.ok) {
      setBraki(wynik.braki);
      return;
    }
    setBraki([]);
    setBusy(true);
    try {
      const oknaDostepnosci = dostepnosc.flatMap((d) =>
        rozwinDostepnosc(d.dni, d.od_godz, d.do_godz),
      );
      await onSubmit({ ...dane, courseId, dostepnosc: oknaDostepnosci });
      setSukces(true);
    } catch (err) {
      setBlad((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sukces) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <Card>
          <CardHeader>
            <CardTitle>Zgłoszenie wysłane</CardTitle>
            <CardDescription>
              Twoje zgłoszenie oczekuje na zatwierdzenie przez biuro OSK.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <Card>
        <CardHeader>
          <CardTitle>Zapis na kurs</CardTitle>
          <CardDescription>Wypełnij formularz zgłoszeniowy.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={wyslij} className="space-y-4" noValidate>
            <Pole id="imie" label="Imię" value={f.imie} onChange={set("imie")} />
            <Pole id="nazwisko" label="Nazwisko" value={f.nazwisko} onChange={set("nazwisko")} />
            <Pole id="email" label="E-mail" type="email" value={f.email} onChange={set("email")} />
            <Pole id="telefon" label="Telefon" value={f.telefon} onChange={set("telefon")} />
            <Pole id="kategoria" label="Kategoria" value={f.kategoria} onChange={set("kategoria")} />
            <Pole id="pkkNumber" label="Numer PKK" value={f.pkkNumber} onChange={set("pkkNumber")} />
            <Pole
              id="dataUrodzenia"
              label="Data urodzenia"
              type="date"
              value={f.dataUrodzenia}
              onChange={set("dataUrodzenia")}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.zgodaRodo}
                onChange={(e) => set("zgodaRodo")(e.target.checked)}
              />
              Wyrażam zgodę na przetwarzanie danych (RODO)
            </label>

            <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
              <Label>Preferowane dni i godziny jazd praktycznych</Label>
              <p className="text-xs text-[var(--muted-foreground)]">
                Opcjonalne — pomaga dobrać terminy jazd. Możesz dodać kilka zakresów.
              </p>
              {dostepnosc.map((d, i) => (
                <p key={i} className="text-xs text-[var(--muted-foreground)]">
                  {d.dni.length} dni, {d.od_godz}–{d.do_godz}
                </p>
              ))}
              <WorkingHoursForm
                etykietaDni="Dni"
                tekstPrzycisku="Dodaj zakres dostępności"
                onSubmit={(d) => setDostepnosc((prev) => [...prev, d])}
              />
            </div>

            {niepelnoletni && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.zgodaOpiekuna}
                  onChange={(e) => set("zgodaOpiekuna")(e.target.checked)}
                />
                Zgoda opiekuna prawnego (kandydat niepełnoletni)
              </label>
            )}

            {braki.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--destructive)]" role="alert">
                {braki.map((b) => (
                  <li key={b}>Uzupełnij: {b}</li>
                ))}
              </ul>
            )}
            {blad && (
              <p className="text-sm text-[var(--destructive)]" role="alert">
                {blad}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Pole(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
