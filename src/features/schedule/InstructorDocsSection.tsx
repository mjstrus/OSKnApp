import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyDocStatus, uploadInstructorDoc } from "./api";

/** Dwa wymagane dokumenty do "w pełni aktywnego konta": umowa + skan legitymacji. Znika po komplecie. */
export function InstructorDocsSection({ instructorId }: { instructorId: string }) {
  const [status, setStatus] = React.useState<{ umowa: boolean; legitymacja: boolean } | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      setStatus(await getMyDocStatus(instructorId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [instructorId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function wgraj(kind: "umowa" | "legitymacja", file: File | undefined) {
    if (!file) return;
    setBlad(null);
    try {
      await uploadInstructorDoc(instructorId, kind, file);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (!status || (status.umowa && status.legitymacja)) return null;

  return (
    <Card className="border-[var(--destructive)]">
      <CardHeader>
        <CardTitle>Uzupełnij dokumenty</CardTitle>
        <CardDescription>
          Wgraj oba, żeby konto było w pełni aktywne. Widzi je tylko admin Twojego OSK.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        <div className="flex items-center gap-3 text-sm">
          <span className="w-32">Umowa z OSK</span>
          {status.umowa ? (
            <span className="text-green-600">Wgrana</span>
          ) : (
            <input type="file" accept="application/pdf,image/*" onChange={(e) => wgraj("umowa", e.target.files?.[0])} />
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="w-32">Skan legitymacji</span>
          {status.legitymacja ? (
            <span className="text-green-600">Wgrana</span>
          ) : (
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => wgraj("legitymacja", e.target.files?.[0])}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
