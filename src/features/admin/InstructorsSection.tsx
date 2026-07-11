import * as React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffForm } from "./StaffForm";
import { InstructorRequestsSection } from "./InstructorRequestsSection";
import { createStaff, deleteInstructor, listInstructors, type InstruktorRow } from "./api";

const TYP_LABEL: Record<string, string> = {
  instruktor_praktyki: "instruktor praktyki",
  wykladowca: "wykładowca",
  instruktor_2w1: "instruktor 2w1",
};

export function InstructorsSection({ oskId }: { oskId: string }) {
  const [instruktorzy, setInstruktorzy] = React.useState<InstruktorRow[]>([]);
  const [komunikat, setKomunikat] = React.useState<string | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setInstruktorzy(await listInstructors(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodaj(d: Parameters<typeof createStaff>[0]) {
    setBlad(null);
    setKomunikat(null);
    try {
      await createStaff(d);
      setKomunikat(`Dodano konto ${d.email}. Wysłano link dostępu na e-mail.`);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usunInstruktora(i: InstruktorRow) {
    const potwierdzone = window.confirm(
      `Usunąć ${i.imie} ${i.nazwisko}? Usunie to też jego godziny pracy, przypisania do kursów i historię slotów jazd.`,
    );
    if (!potwierdzone) return;
    setBlad(null);
    try {
      await deleteInstructor(i.id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <InstructorRequestsSection oskId={oskId} />
      <Card id="nowy-instruktor">
        <CardHeader>
          <CardTitle>Nowy pracownik</CardTitle>
          <CardDescription>
            Instruktor, wykładowca, 2w1 albo pracownik biurowy — tworzy konto i wysyła link dostępu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffForm onSubmit={dodaj} />
          {komunikat && <p className="mt-2 text-sm text-green-600">{komunikat}</p>}
          {blad && <p className="mt-2 text-sm text-[var(--destructive)]">{blad}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instruktorzy i wykładowcy</CardTitle>
          <CardDescription>Kliknij pracownika, żeby zobaczyć umowę, godziny pracy i dostęp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {instruktorzy.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Brak instruktorów.</p>
          )}
          {instruktorzy.map((i, idx) => (
            <div
              key={i.id}
              className="flex items-center justify-between border-b border-[var(--border)] py-2"
            >
              <span className="flex items-baseline gap-3 text-sm">
                <span className="w-6 text-[var(--muted-foreground)]">{idx + 1}.</span>
                <Link to={`/panel/instruktorzy/${i.id}`} className="font-medium hover:underline">
                  {i.imie} {i.nazwisko}
                </Link>
                <span className="text-[var(--muted-foreground)]">— {TYP_LABEL[i.typ] ?? i.typ}</span>
                {!i.aktywny && <span className="text-[var(--destructive)]">nieaktywny</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => usunInstruktora(i)}>
                Usuń
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
