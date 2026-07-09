import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { AvailabilitySection } from "./AvailabilitySection";
import { deleteMyData, exportMyData } from "./api";

/** RODO (eksport/usunięcie danych) + dostępność na jazdy — oba "moje ustawienia" kursanta. */
export function MyDataSection({ enrollmentId }: { enrollmentId: string }) {
  const { oskId, signOut } = useAuth();
  const [blad, setBlad] = React.useState<string | null>(null);

  async function eksportuj() {
    setBlad(null);
    try {
      const dane = await exportMyData();
      const blob = new Blob([JSON.stringify(dane, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moje-dane.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usun() {
    if (!oskId) return;
    if (!window.confirm("Usunąć wszystkie Twoje dane w tym OSK? Tej operacji nie da się cofnąć.")) return;
    setBlad(null);
    try {
      await deleteMyData(oskId);
      await signOut();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <AvailabilitySection oskId={oskId!} enrollmentId={enrollmentId} />

      <Card>
        <CardHeader>
          <CardTitle>Moje dane</CardTitle>
          <CardDescription>RODO: pobierz kopię swoich danych albo poproś o ich usunięcie.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void eksportuj()}>
            Eksportuj dane
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-[var(--destructive)] text-[var(--destructive)]"
            onClick={() => void usun()}
          >
            Usuń moje dane
          </Button>
          {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
