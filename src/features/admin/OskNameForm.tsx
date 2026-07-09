import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  nazwa: string;
  onSave: (nazwa: string) => void | Promise<void>;
}

// Charakterystyka OSK: edytowalna nazwa (RLS: osk_update_admin).
export function OskNameForm({ nazwa, onSave }: Props) {
  const [wartosc, setWartosc] = React.useState(nazwa);
  const [zapisano, setZapisano] = React.useState(false);

  React.useEffect(() => setWartosc(nazwa), [nazwa]);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!wartosc.trim()) return;
    await onSave(wartosc.trim());
    setZapisano(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nazwa OSK</CardTitle>
        <CardDescription>Widoczna w nagłówku aplikacji i dokumentach.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={zapisz} className="flex items-end gap-2" noValidate>
          <div className="flex-1 space-y-2">
            <Label htmlFor="osk-nazwa">Nazwa</Label>
            <Input
              id="osk-nazwa"
              value={wartosc}
              onChange={(e) => {
                setWartosc(e.target.value);
                setZapisano(false);
              }}
            />
          </div>
          <Button type="submit">Zapisz</Button>
        </form>
        {zapisano && <p className="mt-2 text-sm text-green-600">Zapisano.</p>}
      </CardContent>
    </Card>
  );
}
