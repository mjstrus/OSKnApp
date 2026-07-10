// ============================================================================
// Edge Function: create-staff — admin dodaje personel (instruktor/wykładowca/2w1)
//
// Tworzenie konta wymaga service_role (Admin API), więc idzie przez Edge Function.
// Admin podaje e-mail + typ; zamiast wymyślać hasło, funkcja generuje link
// dostępu (Supabase Admin generateLink) i wysyła go mailem przez Resend —
// personel sam ustawia hasło po kliknięciu (ResetPasswordPage już to obsługuje,
// bo link zakłada sesję tak samo jak reset hasła). Idempotentnie po e-mailu/membership.
//
// Deploy: supabase functions deploy create-staff
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { wyslijEmail } from "../_shared/email.ts";

type Rola = "instruktor" | "wykladowca" | "instruktor_2w1";
type Typ = "instruktor_praktyki" | "wykladowca" | "instruktor_2w1";

interface Body {
  email: string;
  rola: Rola;
  typ?: Typ;
  imie: string;
  nazwisko: string;
  numerLegitymacji: string;
  /** Origin frontendu wołającego admina — dokąd wraca po ustawieniu hasła. */
  redirectTo?: string;
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
  const { email, rola, imie, nazwisko, numerLegitymacji } = body ?? {};
  if (!email || !rola || !imie || !nazwisko || !numerLegitymacji) {
    return json({ error: "Wymagane: email, rola, imie, nazwisko, numerLegitymacji" }, 400);
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

  // Konto + link dostępu: generateLink 'invite' tworzy konto od razu; jeśli
  // e-mail już istnieje (ponowne dodanie/literówka poprawiona), fallback na
  // 'magiclink' — użytkownik i tak dostaje świeży, jednorazowy link logowania.
  const redirectTo = body.redirectTo || url;
  let userId: string | undefined;
  let actionLink: string | undefined;

  const { data: invite, error: inviteErr } = await db.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (invite?.user) {
    userId = invite.user.id;
    actionLink = invite.properties?.action_link;
  } else if (inviteErr) {
    const { data: list } = await db.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === email)?.id;
    if (userId) {
      const { data: magic } = await db.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      actionLink = magic?.properties?.action_link;
    }
  }
  if (!userId) return json({ error: "Nie udało się utworzyć konta" }, 400);

  if (actionLink) {
    await wyslijEmail(
      email,
      "Dostęp do OSKnAPP",
      `<p>Cześć ${imie},</p><p>Dodano Cię do systemu OSKnAPP. Kliknij poniżej, żeby ustawić hasło i się zalogować:</p><p><a href="${actionLink}">Ustaw hasło i zaloguj się</a></p>`,
    );
  }

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
