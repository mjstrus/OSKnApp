import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DaneKursu {
  nazwa: string;
  kategoria: string;
  h_teoria: number;
  h_praktyka: number;
  data_poczatku: string | null;
  docelowy_czas_dni: number | null;
  min_uczestnicy: number;
  max_uczestnicy: number | null;
  powiadomienie_przy_liczbie: number | null;
  auto_zamknij_przy_limicie: boolean;
  auto_zamknij_po_dniach: number | null;
}

// Konfiguracja kursu przez admina (R2): profil godzinowy + termin + limity zapisów.
export function CourseForm({ onSubmit }: { onSubmit: (d: DaneKursu) => void | Promise<void> }) {
  const [nazwa, setNazwa] = React.useState("");
  const [kategoria, setKategoria] = React.useState("B");
  const [hTeoria, setHTeoria] = React.useState("30");
  const [hPraktyka, setHPraktyka] = React.useState("30");
  const [dataPoczatku, setDataPoczatku] = React.useState("");
  const [docelowyCzasDni, setDocelowyCzasDni] = React.useState("");
  const [minUczestnicy, setMinUczestnicy] = React.useState("1");
  const [maxUczestnicy, setMaxUczestnicy] = React.useState("");
  const [powiadomPrzy, setPowiadomPrzy] = React.useState("");
  const [zamknijPrzyLimicie, setZamknijPrzyLimicie] = React.useState(false);
  const [zamknijPoDniach, setZamknijPoDniach] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);

  function liczbaAlboNull(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(hTeoria);
    const p = Number(hPraktyka);
    const min = Number(minUczestnicy);
    const max = liczbaAlboNull(maxUczestnicy);
    if (!nazwa.trim()) return setBlad("Podaj nazwę kursu");
    if (!Number.isFinite(t) || t < 0 || !Number.isFinite(p) || p < 0) {
      return setBlad("Godziny muszą być liczbami ≥ 0");
    }
    if (!Number.isFinite(min) || min < 1) return setBlad("Min. liczba uczestników musi być ≥ 1");
    if (max !== null && max < min) {
      return setBlad("Maksymalna liczba uczestników nie może być mniejsza niż minimalna");
    }
    setBlad(null);
    await onSubmit({
      nazwa: nazwa.trim(),
      kategoria,
      h_teoria: t,
      h_praktyka: p,
      data_poczatku: dataPoczatku || null,
      docelowy_czas_dni: liczbaAlboNull(docelowyCzasDni),
      min_uczestnicy: min,
      max_uczestnicy: max,
      powiadomienie_przy_liczbie: liczbaAlboNull(powiadomPrzy),
      auto_zamknij_przy_limicie: zamknijPrzyLimicie,
      auto_zamknij_po_dniach: zamknijPoDniach ? liczbaAlboNull(zamknijPoDniach) : null,
    });
    setNazwa("");
  }

  return (
    <form onSubmit={zapisz} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="k-nazwa">Nazwa kursu</Label>
        <Input id="k-nazwa" value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="k-kat">Kategoria</Label>
          <Input id="k-kat" value={kategoria} onChange={(e) => setKategoria(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="k-data">Planowany termin rozpoczęcia</Label>
          <Input
            id="k-data"
            type="date"
            value={dataPoczatku}
            onChange={(e) => setDataPoczatku(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="k-teoria">Godziny teorii</Label>
          <Input
            id="k-teoria"
            type="number"
            value={hTeoria}
            onChange={(e) => setHTeoria(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="k-praktyka">Godziny praktyki</Label>
          <Input
            id="k-praktyka"
            type="number"
            value={hPraktyka}
            onChange={(e) => setHPraktyka(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="k-czas-dni">Docelowy czas realizacji kursu (dni)</Label>
        <Input
          id="k-czas-dni"
          type="number"
          placeholder="np. 45"
          value={docelowyCzasDni}
          onChange={(e) => setDocelowyCzasDni(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="k-min">Min. uczestników</Label>
          <Input
            id="k-min"
            type="number"
            value={minUczestnicy}
            onChange={(e) => setMinUczestnicy(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="k-max">Maks. uczestników</Label>
          <Input
            id="k-max"
            type="number"
            value={maxUczestnicy}
            onChange={(e) => setMaxUczestnicy(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="k-powiadom">Powiadom przy liczbie</Label>
          <Input
            id="k-powiadom"
            type="number"
            value={powiadomPrzy}
            onChange={(e) => setPowiadomPrzy(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={zamknijPrzyLimicie}
            onChange={(e) => setZamknijPrzyLimicie(e.target.checked)}
          />
          Zamknij zapisy automatycznie po osiągnięciu limitu uczestników
        </label>
        <div className="flex items-center gap-2">
          <Label htmlFor="k-dni-zamkniecia" className="whitespace-nowrap">
            Zamknij zapisy po (dniach od ogłoszenia)
          </Label>
          <Input
            id="k-dni-zamkniecia"
            type="number"
            className="w-24"
            value={zamknijPoDniach}
            onChange={(e) => setZamknijPoDniach(e.target.value)}
          />
        </div>
      </div>
      {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
      <Button type="submit">Dodaj kurs</Button>
    </form>
  );
}
