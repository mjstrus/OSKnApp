// ============================================================================
// Edge Function: create-staff — admin dodaje personel (instruktor/wykładowca/2w1)
//
// Tworzenie konta wymaga service_role (Admin API), więc idzie przez Edge Function.
// Admin podaje e-mail + hasło + typ; funkcja zakłada konto, membership i rekord
// instruktora w OSK wołającego admina. Idempotentnie po e-mailu/membership.
//
// Deploy: supabase functions deploy create-staff
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type Rola = "instruktor" | "wykladowca" | "instruktor_2w1";
type Typ = "instruktor_praktyki" | "wykladowca" | "instruktor_2w1";

interface Body {
  email: string;
  password: string;
  rola: Rola;
  typ?: Typ;
  imie: string;
  nazwisko: string;
  numerLegitymacji: string;
}

const TYP_DOMYSLNY: Record<Rola, Typ> = {
  instruktor: "instruktor_praktyki",
  wykladowca: "wykladowca",
  instruktor_2w1: "instruktor_2w1",
};

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
  const { email, password, rola, imie, nazwisko, numerLegitymacji } = body ?? {};
  if (!email || !password || !rola || !imie || !nazwisko || !numerLegitymacji) {
    return json(
      { error: "Wymagane: email, password, rola, imie, nazwisko, numerLegitymacji" },
      400,
    );
  }
  if (!TYP_DOMYSLNY[rola]) return json({ error: "Nieprawidłowa rola" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const uid = (await userClient.auth.getUser()).data.user?.id;
  if (!uid) return json({ error: "Nieuwierzytelniony" }, 401);

  const db = createClient(url, serviceKey);

  // OSK wołającego admina (MVP: admin ma jedno OSK).
  const { data: adminM } = await db
    .from("membership")
    .select("osk_id")
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (!adminM) return json({ error: "Wymagane uprawnienia admina" }, 403);
  const oskId = adminM.osk_id as string;

  // Konto: utwórz albo znajdź po e-mailu.
  let userId: string | undefined;
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else if (cErr) {
    const { data: list } = await db.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === email)?.id;
  }
  if (!userId) return json({ error: "Nie udało się utworzyć konta" }, 400);

  // Membership (idempotentnie).
  let membershipId: string;
  const { data: istn } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", oskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (istn) {
    membershipId = istn.id as string;
    await db.from("membership").update({ rola }).eq("id", membershipId);
  } else {
    const { data: m, error: mErr } = await db
      .from("membership")
      .insert({ osk_id: oskId, user_id: userId, rola })
      .select("id")
      .single();
    if (mErr || !m) return json({ error: mErr?.message ?? "Błąd membership" }, 400);
    membershipId = m.id as string;
  }

  // Rekord instruktora (idempotentnie po membership) — dane osobowe zawsze
  // aktualizowane, gdyby admin poprawiał literówkę przy ponownym dodaniu.
  const typ = body.typ ?? TYP_DOMYSLNY[rola];
  const { data: instIstn } = await db
    .from("instructor")
    .select("id")
    .eq("membership_id", membershipId)
    .maybeSingle();
  let instructorId = instIstn?.id as string | undefined;
  if (!instructorId) {
    const { data: inst, error: iErr } = await db
      .from("instructor")
      .insert({
        osk_id: oskId,
        membership_id: membershipId,
        typ,
        imie,
        nazwisko,
        numer_legitymacji: numerLegitymacji,
      })
      .select("id")
      .single();
    if (iErr || !inst) return json({ error: iErr?.message ?? "Błąd instruktora" }, 400);
    instructorId = inst.id as string;
  } else {
    await db
      .from("instructor")
      .update({ typ, imie, nazwisko, numer_legitymacji: numerLegitymacji })
      .eq("id", instructorId);
  }

  return json({ userId, membershipId, instructorId }, 201);
});
