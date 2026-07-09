import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TYPY = [
  { wartosc: "urlop", label: "Urlop / niedyspozycyjność" },
  { wartosc: "problem", label: "Problem / usterka" },
  { wartosc: "zmiana_grafiku", label: "Prośba o zmianę grafiku" },
  { wartosc: "inne", label: "Inne" },
];

interface Props {
  onSubmit: (typ: string, tresc: string) => void | Promise<void>;
}

// Zgłoszenie instruktora do admina — widoczne na pulpicie admina jako kafelek.
export function InstructorRequestForm({ onSubmit }: Props) {
  const [typ, setTyp] = React.useState(TYPY[0]!.wartosc);
  const [tresc, setTresc] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);
  const [wyslano, setWyslano] = React.useState(false);

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    if (!tresc.trim()) return setBlad("Opisz zgłoszenie");
    setBlad(null);
    await onSubmit(typ, tresc.trim());
    setTresc("");
    setWyslano(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zgłoś do admina</CardTitle>
        <CardDescription>Urlop, problem, prośba o zmianę grafiku — trafi na pulpit admina.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={wyslij} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="ir-typ">Rodzaj zgłoszenia</Label>
            <select
              id="ir-typ"
              className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
              value={typ}
              onChange={(e) => {
                setTyp(e.target.value);
                setWyslano(false);
              }}
            >
              {TYPY.map((t) => (
                <option key={t.wartosc} value={t.wartosc}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ir-tresc">Treść</Label>
            <textarea
              id="ir-tresc"
              className="min-h-24 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={tresc}
              onChange={(e) => {
                setTresc(e.target.value);
                setWyslano(false);
              }}
            />
          </div>
          {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
          {wyslano && <p className="text-sm text-green-600">Zgłoszenie wysłane.</p>}
          <Button type="submit">Wyślij</Button>
        </form>
      </CardContent>
    </Card>
  );
}
