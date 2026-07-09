import { supabase } from "@/lib/supabase";
import type { Wiadomosc } from "./ChatWindow";

interface WiadomoscRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  tresc: string;
  created_at: string;
}

const naWiadomosc = (r: WiadomoscRow, mojeMembershipId: string): Wiadomosc => ({
  id: r.id,
  tresc: r.tresc,
  odMnie: r.sender_id === mojeMembershipId,
});

/** Moje membership id w danym OSK (nadawca w chacie). */
export async function getMyMembershipId(oskId: string): Promise<string | null> {
  const { data } = await supabase
    .from("membership")
    .select("id")
    .eq("osk_id", oskId)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/** Membership „biura" (pierwszy admin OSK) — partner rozmowy kursant↔biuro. */
export async function getBiuroMembershipId(oskId: string): Promise<string | null> {
  const { data } = await supabase
    .from("membership")
    .select("id")
    .eq("osk_id", oskId)
    .eq("rola", "admin")
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function fetchConversation(
  mojeMembershipId: string,
  innyMembershipId: string,
): Promise<Wiadomosc[]> {
  const { data, error } = await supabase
    .from("chat_message")
    .select("id, sender_id, recipient_id, tresc, created_at")
    .or(
      `and(sender_id.eq.${mojeMembershipId},recipient_id.eq.${innyMembershipId}),` +
        `and(sender_id.eq.${innyMembershipId},recipient_id.eq.${mojeMembershipId})`,
    )
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => naWiadomosc(r as WiadomoscRow, mojeMembershipId));
}

export async function sendMessage(params: {
  oskId: string;
  senderId: string;
  recipientId: string;
  tresc: string;
}): Promise<void> {
  const { error } = await supabase.from("chat_message").insert({
    osk_id: params.oskId,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    tresc: params.tresc,
  });
  if (error) throw error;
}

/** Subskrypcja Realtime nowych wiadomości; zwraca funkcję odsubskrybowania. */
export function subscribeMessages(
  mojeMembershipId: string,
  onNowa: (w: Wiadomosc) => void,
): () => void {
  const channel = supabase
    .channel(`chat:${mojeMembershipId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_message" },
      (payload) => {
        const row = payload.new as WiadomoscRow;
        if (row.sender_id === mojeMembershipId || row.recipient_id === mojeMembershipId) {
          onNowa(naWiadomosc(row, mojeMembershipId));
        }
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
