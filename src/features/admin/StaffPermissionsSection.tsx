import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEKCJE_ADMINA, deleteStaff, listStaff, updateStaffPermissions, type StaffRow } from "./api";

/** Personel biurowy: kto ma dostęp do których zakładek (tylko UI — patrz migracja 0018). */
export function StaffPermissionsSection({ oskId }: { oskId: string }) {
  const [staff, setStaff] = React.useState<StaffRow[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setStaff(await listStaff(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function przelacz(s: StaffRow, klucz: string) {
    const nowe = s.uprawnienia.includes(klucz)
      ? s.uprawnienia.filter((k) => k !== klucz)
      : [...s.uprawnienia, klucz];
    setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, uprawnienia: nowe } : x)));
    try {
      await updateStaffPermissions(s.id, nowe);
    } catch (e) {
      setBlad((e as Error).message);
      await odswiez();
    }
  }

  async function usun(s: StaffRow) {
    if (!window.confirm(`Usunąć dostęp dla ${s.imie} ${s.nazwisko}?`)) return;
    try {
      await deleteStaff(s.id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (staff.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personel biurowy</CardTitle>
        <CardDescription>Dostęp do zakładek — zmiana zapisuje się od razu.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        {staff.map((s) => (
          <div key={s.id} className="space-y-2 border-b border-[var(--border)] pb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {s.imie} {s.nazwisko}
              </span>
              <Button size="sm" variant="ghost" onClick={() => usun(s)}>
                Usuń
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {SEKCJE_ADMINA.map((sek) => (
                <label key={sek.klucz} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={s.uprawnienia.includes(sek.klucz)}
                    onChange={() => przelacz(s, sek.klucz)}
                  />
                  {sek.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
