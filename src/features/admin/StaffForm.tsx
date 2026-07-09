import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DaneStaff {
  email: string;
  password: string;
  rola: "instruktor" | "wykladowca" | "instruktor_2w1";
  imie: string;
  nazwisko: string;
  numerLegitymacji: string;
}

const ROLE: { wartosc: DaneStaff["rola"]; label: string }[] = [
  { wartosc: "instruktor", label: "Instruktor praktyki" },
  { wartosc: "wykladowca", label: "Wykładowca (teoria)" },
  { wartosc: "instruktor_2w1", label: "Instruktor 2w1" },
];

// Dodawanie personelu (R3): konto + dane osobowe + rola. Konto tworzy Edge Function create-staff.
export function StaffForm({ onSubmit }: { onSubmit: (d: DaneStaff) => void | Promise<void> }) {
  const [imie, setImie] = React.useState("");
  const [nazwisko, setNazwisko] = React.useState("");
  const [numerLegitymacji, setNumerLegitymacji] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rola, setRola] = React.useState<DaneStaff["rola"]>("instruktor");
  const [blad, setBlad] = React.useState<string | null>(null);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!imie.trim()) return setBlad("Podaj imię");
    if (!nazwisko.trim()) return setBlad("Podaj nazwisko");
    if (!numerLegitymacji.trim()) return setBlad("Podaj numer legitymacji instruktorskiej");
    if (!email.trim()) return setBlad("Podaj e-mail");
    if (password.length < 6) return setBlad("Hasło min. 6 znaków");
    setBlad(null);
    await onSubmit({
      email: email.trim(),
      password,
      rola,
      imie: imie.trim(),
      nazwisko: nazwisko.trim(),
      numerLegitymacji: numerLegitymacji.trim(),
    });
    setImie("");
    setNazwisko("");
    setNumerLegitymacji("");
    setEmail("");
    setPassword("");
  }

  return (
    <form onSubmit={zapisz} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="s-imie">Imię</Label>
          <Input id="s-imie" value={imie} onChange={(e) => setImie(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-nazwisko">Nazwisko</Label>
          <Input id="s-nazwisko" value={nazwisko} onChange={(e) => setNazwisko(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-legitymacja">Numer legitymacji instruktorskiej</Label>
        <Input
          id="s-legitymacja"
          value={numerLegitymacji}
          onChange={(e) => setNumerLegitymacji(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-email">E-mail</Label>
        <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-haslo">Hasło początkowe</Label>
        <Input
          id="s-haslo"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-rola">Rola</Label>
        <select
          id="s-rola"
          className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
          value={rola}
          onChange={(e) => setRola(e.target.value as DaneStaff["rola"])}
        >
          {ROLE.map((r) => (
            <option key={r.wartosc} value={r.wartosc}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
      <Button type="submit">Dodaj personel</Button>
    </form>
  );
}
