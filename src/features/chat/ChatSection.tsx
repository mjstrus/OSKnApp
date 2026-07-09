import * as React from "react";
import { ChatWindow, type Wiadomosc } from "./ChatWindow";
import {
  fetchConversation,
  getBiuroMembershipId,
  getMyMembershipId,
  sendMessage,
  subscribeMessages,
} from "./api";

// Rozmowa kursant↔biuro (R15). Ten sam komponent obsłuży kursant↔instruktor
// po podaniu innego membership partnera.
export function ChatSection({ oskId }: { oskId: string }) {
  const [wiadomosci, setWiadomosci] = React.useState<Wiadomosc[]>([]);
  const [ja, setJa] = React.useState<string | null>(null);
  const [partner, setPartner] = React.useState<string | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);

  React.useEffect(() => {
    let odsub = () => {};
    (async () => {
      try {
        const [mid, bid] = await Promise.all([
          getMyMembershipId(oskId),
          getBiuroMembershipId(oskId),
        ]);
        if (!mid || !bid) {
          setBlad("Brak rozmówcy (biura) w OSK.");
          return;
        }
        setJa(mid);
        setPartner(bid);
        setWiadomosci(await fetchConversation(mid, bid));
        odsub = subscribeMessages(mid, (w) =>
          setWiadomosci((prev) => (prev.some((p) => p.id === w.id) ? prev : [...prev, w])),
        );
      } catch (e) {
        setBlad((e as Error).message);
      }
    })();
    return () => odsub();
  }, [oskId]);

  async function wyslij(tresc: string) {
    if (!ja || !partner) return;
    await sendMessage({ oskId, senderId: ja, recipientId: partner, tresc });
  }

  if (blad) return <p className="p-2 text-sm text-[var(--destructive)]">{blad}</p>;
  return (
    <div className="h-[60vh] rounded-lg border border-[var(--border)]">
      <ChatWindow wiadomosci={wiadomosci} onSend={wyslij} />
    </div>
  );
}
