import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addVehicle, deleteVehicle, listVehicles, setVehicleActive, type VehicleRow } from "./api";

const PUSTE = {
  nr_rejestracyjny: "",
  marka_model: "",
  przeglad_do: "",
  ubezpieczenie_do: "",
  przebieg_biezacy: "0",
  serwis_limit_km: "15000",
};

// Flota aut — osobny zasób od instruktorów; limity serwisowe (km) ustawiane
// indywidualnie przez admina, wejście dla silnika pojemności kursu.
export function FleetSection({ oskId }: { oskId: string }) {
  const [auta, setAuta] = React.useState<VehicleRow[]>([]);
  const [dane, setDane] = React.useState(PUSTE);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setAuta(await listVehicles(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  function pole<K extends keyof typeof PUSTE>(k: K, v: string) {
    setDane((prev) => ({ ...prev, [k]: v }));
  }

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    if (!dane.nr_rejestracyjny.trim()) return setBlad("Podaj numer rejestracyjny");
    const przebieg = Number(dane.przebieg_biezacy);
    const limit = Number(dane.serwis_limit_km);
    if (!Number.isFinite(przebieg) || przebieg < 0) return setBlad("Przebieg musi być liczbą ≥ 0");
    if (!Number.isFinite(limit) || limit <= 0) return setBlad("Limit serwisowy musi być liczbą > 0");
    setBlad(null);
    try {
      await addVehicle(oskId, {
        nr_rejestracyjny: dane.nr_rejestracyjny.trim(),
        marka_model: dane.marka_model.trim(),
        przeglad_do: dane.przeglad_do || null,
        ubezpieczenie_do: dane.ubezpieczenie_do || null,
        przebieg_biezacy: przebieg,
        serwis_limit_km: limit,
      });
      setDane(PUSTE);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usun(id: string) {
    try {
      await deleteVehicle(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function przelaczAktywne(id: string, aktywny: boolean) {
    try {
      await setVehicleActive(id, aktywny);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flota aut</CardTitle>
        <CardDescription>
          Numer rejestracyjny, przegląd, ubezpieczenie, serwis. Limit km serwisowy ustaw
          indywidualnie dla auta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={dodaj} className="grid grid-cols-3 gap-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="auto-nr">Numer rejestracyjny</Label>
            <Input
              id="auto-nr"
              value={dane.nr_rejestracyjny}
              onChange={(e) => pole("nr_rejestracyjny", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-model">Marka / model</Label>
            <Input
              id="auto-model"
              value={dane.marka_model}
              onChange={(e) => pole("marka_model", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-przebieg">Przebieg (km)</Label>
            <Input
              id="auto-przebieg"
              type="number"
              value={dane.przebieg_biezacy}
              onChange={(e) => pole("przebieg_biezacy", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-przeglad">Przegląd do</Label>
            <Input
              id="auto-przeglad"
              type="date"
              value={dane.przeglad_do}
              onChange={(e) => pole("przeglad_do", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-ubezpieczenie">Ubezpieczenie do</Label>
            <Input
              id="auto-ubezpieczenie"
              type="date"
              value={dane.ubezpieczenie_do}
              onChange={(e) => pole("ubezpieczenie_do", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-limit">Limit serwisowy (km)</Label>
            <Input
              id="auto-limit"
              type="number"
              value={dane.serwis_limit_km}
              onChange={(e) => pole("serwis_limit_km", e.target.value)}
            />
          </div>
          <Button type="submit" className="col-span-3 w-fit">
            Dodaj auto
          </Button>
        </form>
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

        <div className="space-y-1">
          {auta.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Brak aut we flocie.</p>
          )}
          {auta.map((a) => {
            const doSerwisu = a.serwis_limit_km - (a.przebieg_biezacy - a.serwis_ostatni_przebieg);
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--muted)] px-2 py-1 text-sm"
              >
                <span>
                  {a.nr_rejestracyjny} {a.marka_model && `(${a.marka_model})`} — {a.przebieg_biezacy}
                  km
                  {a.przeglad_do && ` · przegląd do ${a.przeglad_do}`}
                  {a.ubezpieczenie_do && ` · OC/AC do ${a.ubezpieczenie_do}`}
                  {" · do serwisu: "}
                  <span className={doSerwisu < 0 ? "text-[var(--destructive)]" : ""}>
                    {doSerwisu} km
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={a.aktywny}
                      onChange={(e) => przelaczAktywne(a.id, e.target.checked)}
                    />
                    aktywne
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => usun(a.id)}>
                    Usuń
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
