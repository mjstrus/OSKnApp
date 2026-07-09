// ============================================================================
// Edge Function: cancel-slot — odwołanie jazdy (R7, R12)
//
// Kursant (lub admin) odwołuje slot. W oknie odwołania (osk.okno_odwolania_h
// przed startem) → 'odwolany_w_oknie' (nic nie przepada). Po oknie →
// 'nieusprawiedliwiony' — automat liczników (Unit 2) rozstrzyga tolerancję
// (1. raz darmowe przełożenie, 2.+ przepada godzina). NIEZALEŻNIE od okna,
// zwolniony termin trafia na giełdę jako NOWY wiersz (oryginalny slot
// kursanta zostaje nietknięty — to jego historia; giełda to osobny byt,
// żeby nie nadpisywać czyjegoś "odwołałem w terminie" cudzą rezerwacją).
//
// Deploy: supabase functions deploy cancel-slot
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

  // Uwaga: FK-i są złożone (enrollment_id/membership_id + osk_id); embed po
  // nazwach TABEL, nie po aliasach kolumn (PostgREST inaczej nie znajdzie relacji).
  const { data: slot } = await db
    .from("slot")
    .select(
      "id, osk_id, enrollment_id, instructor_id, course_id, start_ts, end_ts, status, enrollment (membership (user_id))",
    )
    .eq("id", slotId)
    .single();
  if (!slot) return json({ error: "Nie znaleziono slotu" }, 404);
  if (slot.status !== "zaplanowany") {
    return json({ error: `Slot nie jest zaplanowany (jest ${slot.status})` }, 409);
  }

  // Autoryzacja: właściciel enrollmentu lub admin.
  const wlascicielId = (
    (slot.enrollment as { membership: { user_id: string } | null } | null)?.membership ?? null
  )?.user_id;
  const { data: admin } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", slot.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (wlascicielId !== uid && !admin) return json({ error: "Brak uprawnień do slotu" }, 403);

  // Okno odwołania per OSK.
  const { data: osk } = await db
    .from("osk")
    .select("okno_odwolania_h")
    .eq("id", slot.osk_id)
    .single();
  const oknoH = (osk?.okno_odwolania_h as number) ?? 24;

  const granica = Date.parse(slot.start_ts) - oknoH * 3600_000;
  const wOknie = Date.now() <= granica;
  const nowyStatus = wOknie ? "odwolany_w_oknie" : "nieusprawiedliwiony";

  const { error: updErr } = await db.from("slot").update({ status: nowyStatus }).eq("id", slotId);
  if (updErr) return json({ error: updErr.message }, 400);

  // Zwolniony termin zawsze na giełdę — osobny wiersz, bez właściciela.
  await db.from("slot").insert({
    osk_id: slot.osk_id,
    course_id: slot.course_id,
    instructor_id: slot.instructor_id,
    start_ts: slot.start_ts,
    end_ts: slot.end_ts,
    status: "wolny_gielda",
  });

  return json({ slotId, status: nowyStatus, wOknie }, 200);
});
