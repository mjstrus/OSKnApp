import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface Wiadomosc {
  id: string;
  tresc: string;
  odMnie: boolean;
}

interface Props {
  wiadomosci: Wiadomosc[];
  onSend: (tresc: string) => void | Promise<void>;
}

// Chat 1:1 (R15). Realtime dostarcza wiadomości do listy; tu tylko prezentacja + wysyłka.
export function ChatWindow({ wiadomosci, onSend }: Props) {
  const [tresc, setTresc] = React.useState("");

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    const t = tresc.trim();
    if (!t) return;
    setTresc("");
    await onSend(t);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-label="Wiadomości">
        {wiadomosci.map((w) => (
          <div
            key={w.id}
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
              w.odMnie
                ? "ml-auto bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--muted)]",
            )}
          >
            {w.tresc}
          </div>
        ))}
      </div>
      <form onSubmit={wyslij} className="flex gap-2 border-t border-[var(--border)] p-2">
        <Input
          aria-label="Treść wiadomości"
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          placeholder="Napisz wiadomość…"
        />
        <Button type="submit">Wyślij</Button>
      </form>
    </div>
  );
}
