import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addRoom, deleteRoom, listRooms, type RoomRow } from "./api";

// Sale wykładowe (nazwa+adres+pojemność) — wejście dla silnika pojemności i
// grafiku kursanta (nazwa/adres sali ma się tam pojawiać przy zajęciach teorii).
export function RoomsSection({ oskId }: { oskId: string }) {
  const [sale, setSale] = React.useState<RoomRow[]>([]);
  const [nazwa, setNazwa] = React.useState("");
  const [adres, setAdres] = React.useState("");
  const [pojemnosc, setPojemnosc] = React.useState("20");
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setSale(await listRooms(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(pojemnosc);
    if (!nazwa.trim()) return setBlad("Podaj nazwę sali");
    if (!Number.isFinite(p) || p <= 0) return setBlad("Pojemność musi być liczbą > 0");
    setBlad(null);
    try {
      await addRoom(oskId, { nazwa: nazwa.trim(), adres: adres.trim(), pojemnosc: p });
      setNazwa("");
      setAdres("");
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usun(id: string) {
    try {
      await deleteRoom(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sale wykładowe</CardTitle>
        <CardDescription>Nazwa i adres pojawią się na grafiku kursanta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={dodaj} className="grid grid-cols-3 gap-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="sala-nazwa">Nazwa sali</Label>
            <Input id="sala-nazwa" value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sala-adres">Adres</Label>
            <Input id="sala-adres" value={adres} onChange={(e) => setAdres(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sala-pojemnosc">Pojemność (miejsc)</Label>
            <Input
              id="sala-pojemnosc"
              type="number"
              value={pojemnosc}
              onChange={(e) => setPojemnosc(e.target.value)}
            />
          </div>
          <Button type="submit" className="col-span-3 w-fit">
            Dodaj salę
          </Button>
        </form>
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

        <div className="space-y-1">
          {sale.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Brak zdefiniowanych sal.</p>
          )}
          {sale.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded bg-[var(--muted)] px-2 py-1 text-sm"
            >
              <span>
                {s.nazwa} {s.adres && `— ${s.adres}`} ({s.pojemnosc} miejsc)
              </span>
              <Button size="sm" variant="ghost" onClick={() => usun(s.id)}>
                Usuń
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
