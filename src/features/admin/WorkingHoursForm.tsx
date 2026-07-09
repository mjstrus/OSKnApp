import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DaneGodzinBulk {
  dni: number[]; // 0=poniedziałek ... 6=niedziela
  od_godz: string;
  do_godz: string;
}

const DNI = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const ROBOCZE = [0, 1, 2, 3, 4];
const WSZYSTKIE = [0, 1, 2, 3, 4, 5, 6];

/**
 * Godziny pracy instruktora (R3) — jeden zakres godzin dla WIELU dni naraz
 * (np. pon-pt 08:00-16:00 jednym kliknięciem), zamiast dnia po dniu.
 */
export function WorkingHoursForm({
  onSubmit,
  etykietaDni = "Dni tygodnia",
  tekstPrzycisku = "Dodaj godziny",
}: {
  onSubmit: (d: DaneGodzinBulk) => void | Promise<void>;
  etykietaDni?: string;
  tekstPrzycisku?: string;
}) {
  const [dni, setDni] = React.useState<number[]>([]);
  const [od, setOd] = React.useState("08:00");
  const [doG, setDoG] = React.useState("16:00");
  const [blad, setBlad] = React.useState<string | null>(null);

  function przelacz(i: number) {
    setDni((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()));
  }

  async function zapisz() {
    if (dni.length === 0) return setBlad("Wybierz co najmniej jeden dzień");
    if (od >= doG) return setBlad("Godzina początkowa musi być wcześniejsza niż końcowa");
    setBlad(null);
    await onSubmit({ dni, od_godz: od, do_godz: doG });
    setDni([]);
  }

  // Renderowane jako <div>, nie <form> — bywa zagnieżdżone w innym formularzu
  // (np. ApplicationForm), a HTML nie pozwala na <form> w <form>.
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{etykietaDni}</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setDni(WSZYSTKIE)}>
            Wszystkie dni
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDni(ROBOCZE)}>
            Dni robocze (pon–pt)
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDni([])}>
            Wyczyść
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          {DNI.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={dni.includes(i)} onChange={() => przelacz(i)} />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wh-od">Od</Label>
          <Input id="wh-od" type="time" value={od} onChange={(e) => setOd(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wh-do">Do</Label>
          <Input id="wh-do" type="time" value={doG} onChange={(e) => setDoG(e.target.value)} />
        </div>
      </div>
      {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
      <Button type="button" onClick={zapisz}>
        {tekstPrzycisku}
      </Button>
    </div>
  );
}
