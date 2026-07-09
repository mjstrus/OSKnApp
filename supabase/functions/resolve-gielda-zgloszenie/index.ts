// ============================================================================
// Edge Function: resolve-gielda-zgloszenie — admin zatwierdza/odrzuca kandydata
// na wolny termin z giełdy.
//
// Zatwierdzenie: slot -> 'zaplanowany' dla wybranego kandydata, WSZYSTKIE
// pozostałe zgłoszenia do tego slotu -> 'odrzucone' (automatycznie, mail do
// każdego odrzuconego). Odrzucenie pojedynczego zgłoszenia: slot zostaje na
// giełdzie, tylko to jedno zgłoszenie -> 'odrzucone'.
//
// Deploy: supabase functions deploy resolve-gielda-zgloszenie
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { wyslijEmail } from "../_shared/email.ts";

interface Body {
  zgloszenieId: string;
  decyzja: "zatwierdz" | "odrzuc";
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
  if (!body?.zgloszenieId || (body.decyzja !== "zatwierdz" && body.decyzja !== "odrzuc")) {
    return json({ error: "Wymagane: zgloszenieId, decyzja ('zatwierdz'|'odrzuc')" }, 400);
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

  const { data: zgloszenie } = await db
    .from("gielda_zgloszenie")
    .select("id, osk_id, slot_id, enrollment_id, status")
    .eq("id", body.zgloszenieId)
    .single();
  if (!zgloszenie) return json({ error: "Nie znaleziono zgłoszenia" }, 404);
  if (zgloszenie.status !== "oczekuje") {
    return json({ error: `Zgłoszenie już rozpatrzone (${zgloszenie.status})` }, 409);
  }

  const { data: admin } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", zgloszenie.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (!admin) return json({ error: "Wymagane uprawnienia admina" }, 403);

  async function emailKandydata(enrollmentId: string): Promise<string | null> {
    const { data: enr } = await db
      .from("enrollment")
      .select("membership (user_id)")
      .eq("id", enrollmentId)
      .single();
    const userId = (enr?.membership as { user_id: string } | null)?.user_id;
    if (!userId) return null;
    const { data: user } = await db.auth.admin.getUserById(userId);
    return user?.user?.email ?? null;
  }

  if (body.decyzja === "odrzuc") {
    await db.from("gielda_zgloszenie").update({ status: "odrzucone" }).eq("id", body.zgloszenieId);
    const email = await emailKandydata(zgloszenie.enrollment_id);
    if (email) {
      await wyslijEmail(
        email,
        "Zgłoszenie na giełdzie odrzucone",
        "<p>Twoje zgłoszenie na wybrany termin z giełdy zostało odrzucone. Termin nadal widoczny na giełdzie dla innych.</p>",
      );
    }
    return json({ status: "odrzucone" }, 200);
  }

  // Zatwierdzenie: atomowo zajmij slot (guard WHERE na wypadek, gdyby ktoś
  // inny zdążył go wcześniej dostać innym kanałem).
  const { data: updated, error: updErr } = await db
    .from("slot")
    .update({ enrollment_id: zgloszenie.enrollment_id, status: "zaplanowany", confirm_by: null })
    .eq("id", zgloszenie.slot_id)
    .eq("status", "wolny_gielda")
    .select("id")
    .maybeSingle();
  if (updErr) return json({ error: updErr.message }, 400);
  if (!updated) return json({ error: "Slot nie jest już dostępny na giełdzie." }, 409);

  await db.from("gielda_zgloszenie").update({ status: "zatwierdzone" }).eq("id", body.zgloszenieId);

  // Pozostałe zgłoszenia do tego samego slotu -> odrzucone, z mailem.
  const { data: pozostale } = await db
    .from("gielda_zgloszenie")
    .update({ status: "odrzucone" })
    .eq("slot_id", zgloszenie.slot_id)
    .eq("status", "oczekuje")
    .neq("id", body.zgloszenieId)
    .select("enrollment_id");

  const zatwierdzonyEmail = await emailKandydata(zgloszenie.enrollment_id);
  if (zatwierdzonyEmail) {
    await wyslijEmail(
      zatwierdzonyEmail,
      "Termin z giełdy zatwierdzony",
      "<p>Twoje zgłoszenie na termin z giełdy zostało zatwierdzone — jazda jest już w Twoim terminarzu.</p>",
    );
  }
  for (const p of pozostale ?? []) {
    const email = await emailKandydata(p.enrollment_id as string);
    if (email) {
      await wyslijEmail(
        email,
        "Zgłoszenie na giełdzie odrzucone",
        "<p>Termin, na który się zgłosiłeś, został przyznany innemu kursantowi.</p>",
      );
    }
  }

  return json({ status: "zatwierdzone" }, 200);
});
