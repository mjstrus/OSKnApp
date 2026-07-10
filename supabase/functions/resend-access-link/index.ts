// ============================================================================
// Edge Function: resend-access-link — admin wysyła nowy jednorazowy link
// logowania istniejącemu instruktorowi/wykładowcy (np. zgubił poprzedni mail).
//
// Deploy: supabase functions deploy resend-access-link
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { wyslijEmail } from "../_shared/email.ts";

interface Body {
  instructorId: string;
  redirectTo?: string;
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
  if (!body?.instructorId) return json({ error: "Wymagane: instructorId" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const uid = (await userClient.auth.getUser()).data.user?.id;
  if (!uid) return json({ error: "Nieuwierzytelniony" }, 401);

  const db = createClient(url, serviceKey);

  const { data: inst } = await db
    .from("instructor")
    .select("membership_id, osk_id, imie")
    .eq("id", body.instructorId)
    .maybeSingle();
  if (!inst) return json({ error: "Nie znaleziono instruktora" }, 404);

  const { data: adminM } = await db
    .from("membership")
    .select("id")
    .eq("user_id", uid)
    .eq("osk_id", inst.osk_id)
    .eq("rola", "admin")
    .maybeSingle();
  if (!adminM) return json({ error: "Wymagane uprawnienia admina" }, 403);

  const { data: czlonek } = await db
    .from("membership")
    .select("user_id")
    .eq("id", inst.membership_id)
    .maybeSingle();
  if (!czlonek) return json({ error: "Brak konta powiązanego z instruktorem" }, 404);

  const { data: user } = await db.auth.admin.getUserById(czlonek.user_id as string);
  const email = user?.user?.email;
  if (!email) return json({ error: "Brak e-maila konta" }, 404);

  const { data: magic, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: body.redirectTo || url },
  });
  if (error || !magic?.properties?.action_link) {
    return json({ error: error?.message ?? "Błąd generowania linku" }, 400);
  }

  await wyslijEmail(
    email,
    "Dostęp do OSKnAPP",
    `<p>Cześć ${inst.imie},</p><p>Kliknij, żeby ustawić hasło i się zalogować:</p><p><a href="${magic.properties.action_link}">Ustaw hasło i zaloguj się</a></p>`,
  );

  return json({ email }, 200);
});
