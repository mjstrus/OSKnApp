// ============================================================================
// Edge Function: confirm-attendance — potwierdzenie obecności po jeździe (R9)
//
// Instruktor (lub admin) zamyka slot: status → 'odbyty' + zdarzenie obecności
// (attendance_event, EKK-ready). Licznik godzin jest liczony z statusów slotów
// przez silnik (Unit 2), więc tu nie duplikujemy liczenia.
//
// Deploy: supabase functions deploy confirm-attendance
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

  let slotId: string;
  try {
    slotId = ((await req.json()) as { slotId: string }).slotId;
  } catch {
    return json({ error: "Nieprawidłowy JSON" }, 400);
  }
  if (!slotId) return json({ error: "Wymagane: slotId" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const uid = (await userClient.auth.getUser()).data.user?.id;
  if (!uid) return json({ error: "Nieuwierzytelniony" }, 401);

  const db = createClient(url, serviceKey);

  const { data: slot } = await db
    .from("slot")
    .select("id, osk_id, instructor_id, start_ts, end_ts, status")
    .eq("id", slotId)
    .single();
  if (!slot) return json({ error: "Nie znaleziono slotu" }, 404);
  if (slot.status !== "zaplanowany") {
    return json({ error: `Slot nie jest zaplanowany (jest ${slot.status})` }, 409);
  }

  // Autoryzacja: admin OSK lub instruktor prowadzący slot.
  const { data: admin } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", slot.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  // Uwaga: FK złożony (membership_id, osk_id) -> membership(id, osk_id); embed
  // po nazwie tabeli, nie po aliasie kolumny (PostgREST inaczej nie znajdzie relacji).
  const { data: instr } = await db
    .from("instructor")
    .select("id, membership (user_id)")
    .eq("id", slot.instructor_id)
    .single();
  const prowadzacy = (instr?.membership as { user_id: string } | null)?.user_id === uid;
  if (!admin && !prowadzacy) return json({ error: "Brak uprawnień do slotu" }, 403);

  const { error: updErr } = await db.from("slot").update({ status: "odbyty" }).eq("id", slotId);
  if (updErr) return json({ error: updErr.message }, 400);

  await db.from("attendance_event").insert({
    osk_id: slot.osk_id,
    slot_id: slotId,
    start_ts: slot.start_ts,
    end_ts: slot.end_ts,
    podpis_instruktor_ts: new Date().toISOString(),
    sync_status: "zsynchronizowany",
  });

  return json({ slotId, status: "odbyty" }, 200);
});
