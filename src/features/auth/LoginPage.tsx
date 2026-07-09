import * as React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [haslo, setHaslo] = React.useState("");
  const [blad, setBlad] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resetWyslany, setResetWyslany] = React.useState(false);

  // Po zalogowaniu (sesja pojawia się w AuthProvider) przejdź do panelu.
  React.useEffect(() => {
    if (session) navigate("/panel", { replace: true });
  }, [session, navigate]);

  async function zaloguj(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: haslo });
    setBusy(false);
    if (error) setBlad(error.message);
  }

  async function resetHasla() {
    if (!email) return setBlad("Podaj e-mail, żeby zresetować hasło");
    setBlad(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-hasla`,
    });
    setBusy(false);
    if (error) setBlad(error.message);
    else setResetWyslany(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Logowanie</CardTitle>
          <CardDescription>Panel OSK</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={zaloguj} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="haslo">Hasło</Label>
              <Input
                id="haslo"
                type="password"
                value={haslo}
                onChange={(e) => setHaslo(e.target.value)}
                required
              />
            </div>
            {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
            {resetWyslany && (
              <p className="text-sm text-green-600">
                Wysłaliśmy link do resetu hasła na podany e-mail.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Logowanie…" : "Zaloguj"}
            </Button>
            <button
              type="button"
              onClick={resetHasla}
              disabled={busy}
              className="w-full text-center text-sm text-[var(--muted-foreground)] hover:underline"
            >
              Zapomniałeś hasła?
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
