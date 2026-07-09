// ============================================================================
// Edge Function: respond-to-practice-proposal — kursant potwierdza/odwołuje
// automatycznie przydzieloną propozycję jazdy praktycznej.
//
// Potwierdzenie: status -> 'zaplanowany'.
// Odwołanie / przeterminowanie: status -> 'wolny_gielda' (giełda — każdy
// zapisany na kurs kursant może go zarezerwować przez claim-gielda-slot).
//
// Deploy: supabase functions deploy respond-to-practice-proposal
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

interface Body {
  slotId: string;
  action: "potwierdz" | "odwolaj";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Nieprawidłowy JSON" }, 400);
  }
  if (!body?.slotId || (body.action !== "potwierdz" && body.action !== "odwolaj")) {
    return json({ error: "Wymagane: slotId, action ('potwierdz'|'odwolaj')" }, 400);
  }

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
    .select("id, osk_id, enrollment_id, status, confirm_by, enrollment (membership (user_id))")
    .eq("id", body.slotId)
    .single();
  if (!slot) return json({ error: "Nie znaleziono slotu" }, 404);

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

  if (slot.status !== "propozycja") {
    return json({ error: `Slot nie jest propozycją (jest ${slot.status})` }, 409);
  }

  // Termin już minął — wygaś do giełdy i poinformuj zamiast wykonać żądaną akcję.
  if (slot.confirm_by && Date.parse(slot.confirm_by as string) < Date.now()) {
    await db
      .from("slot")
      .update({ status: "wolny_gielda", enrollment_id: null, confirm_by: null })
      .eq("id", body.slotId);
    return json({ error: "Czas na potwierdzenie minął — slot trafił do giełdy." }, 409);
  }

  const nowyStatus = body.action === "potwierdz" ? "zaplanowany" : "wolny_gielda";
  const { error: updErr } = await db
    .from("slot")
    .update(
      body.action === "potwierdz"
        ? { status: nowyStatus, confirm_by: null }
        : { status: nowyStatus, enrollment_id: null, confirm_by: null },
    )
    .eq("id", body.slotId);
  if (updErr) return json({ error: updErr.message }, 400);

  return json({ slotId: body.slotId, status: nowyStatus }, 200);
});
