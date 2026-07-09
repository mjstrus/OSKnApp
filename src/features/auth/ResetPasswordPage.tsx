import * as React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Link z e-maila resetu (resetPasswordForEmail) automatycznie zakłada sesję
// (AuthProvider.onAuthStateChange), więc tu wystarczy ustawić nowe hasło.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [haslo, setHaslo] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (haslo.length < 6) return setBlad("Hasło min. 6 znaków");
    setBlad(null);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: haslo });
    setBusy(false);
    if (error) return setBlad(error.message);
    navigate("/panel", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Nowe hasło</CardTitle>
          <CardDescription>Ustaw nowe hasło do konta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={zapisz} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nowe-haslo">Nowe hasło</Label>
              <Input
                id="nowe-haslo"
                type="password"
                value={haslo}
                onChange={(e) => setHaslo(e.target.value)}
                required
              />
            </div>
            {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Zapisywanie…" : "Zapisz hasło"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
