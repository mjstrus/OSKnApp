// ============================================================================
// Edge Function: claim-gielda-slot — kursant ZGŁASZA ZAINTERESOWANIE wolnym
// terminem z giełdy (nie zajmuje go od razu — admin wybiera kandydata spośród
// wszystkich zgłoszonych, patrz resolve-gielda-zgloszenie).
//
// Deploy: supabase functions deploy claim-gielda-slot
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

interface Body {
  slotId: string;
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
  if (!body?.slotId) return json({ error: "Wymagane: slotId" }, 400);

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
    .select("id, osk_id, course_id, status")
    .eq("id", body.slotId)
    .single();
  if (!slot) return json({ error: "Nie znaleziono slotu" }, 404);
  if (slot.status !== "wolny_gielda") {
    return json({ error: `Slot nie jest dostępny na giełdzie (jest ${slot.status})` }, 409);
  }

  // Zapis kursanta na dany kurs + gating R14b (dopuszczony do jazd).
  const { data: membership } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", slot.osk_id)
    .eq("user_id", uid)
    .maybeSingle();
  if (!membership) return json({ error: "Brak członkostwa w tym OSK" }, 403);

  const { data: enrollment } = await db
    .from("enrollment")
    .select("id, cleared_to_drive, course (h_praktyka)")
    .eq("course_id", slot.course_id)
    .eq("membership_id", membership.id)
    .maybeSingle();
  if (!enrollment) return json({ error: "Nie jesteś zapisany na ten kurs" }, 403);
  if (!enrollment.cleared_to_drive) {
    return json({ error: "Kursant nie jest dopuszczony do jazd (R14b)." }, 422);
  }

  // Limit godzin — nie ma sensu zgłaszać się, gdy i tak jest się przy limicie
  // (admin i tak by to odrzucił przy zatwierdzaniu).
  const hPraktyka = (enrollment.course as unknown as { h_praktyka: number } | null)?.h_praktyka ?? 0;
  const { count: aktywneGodziny } = await db
    .from("slot")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollment.id)
    .in("status", ["zaplanowany", "odbyty", "propozycja"]);
  if ((aktywneGodziny ?? 0) >= hPraktyka) {
    return json(
      { error: `Osiągnięto limit ${hPraktyka}h. Odwołaj inny termin, żeby się zgłosić.` },
      422,
    );
  }

  const { error: insErr } = await db
    .from("gielda_zgloszenie")
    .insert({ osk_id: slot.osk_id, slot_id: slot.id, enrollment_id: enrollment.id });
  if (insErr) {
    if (insErr.code === "23505") return json({ error: "Już zgłosiłeś się do tego terminu." }, 409);
    return json({ error: insErr.message }, 400);
  }

  return json({ slotId: body.slotId, status: "zgloszono" }, 201);
});
