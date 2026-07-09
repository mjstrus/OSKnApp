// ============================================================================
// Edge Function: approve-application — maker-checker akceptacji zgłoszenia (R5)
//
// Cienka warstwa nad RPC public.approve_application (atomowa: membership+enrollment
// +dostępność+status). Rola admina jest egzekwowana WEWNĄTRZ RPC przez auth.uid(),
// dlatego RPC wołamy klientem z JWT admina (nie service_role). Klient service_role
// służy tylko do rozwiązania/utworzenia konta kandydata (Admin API).
//
// Deploy: supabase functions deploy approve-application
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

interface ApproveBody {
  applicationId: string;
  /** Konto, które ma zostać kursantem; gdy brak — tworzone z e-maila zgłoszenia. */
  userId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return json({ error: "Nieprawidłowy JSON" }, 400);
  }
  if (!body?.applicationId) return json({ error: "Wymagane: applicationId" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Klient z JWT admina — auth.uid() w RPC = wołający, więc kontrola roli działa.
  const adminClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await adminClient.auth.getUser();
  if (!userData.user?.id) return json({ error: "Nieuwierzytelniony" }, 401);

  const svc = createClient(url, serviceKey);

  // Ustal konto kandydata: podane userId albo znajdź/utwórz po e-mailu zgłoszenia.
  let userId = body.userId;
  if (!userId) {
    const { data: app } = await svc
      .from("candidate_application")
      .select("email")
      .eq("id", body.applicationId)
      .single();
    if (!app?.email) return json({ error: "Nie znaleziono zgłoszenia" }, 404);

    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email: app.email,
      email_confirm: true,
    });
    if (created?.user) {
      userId = created.user.id;
    } else if (cErr) {
      // Konto może już istnieć — odszukaj po e-mailu.
      const { data: list } = await svc.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === app.email)?.id;
    }
    if (!userId) return json({ error: "Nie udało się ustalić konta kandydata" }, 400);
  }

  // Maker-checker atomowo (RPC wykona kontrolę roli admina).
  const { data: enrollmentId, error } = await adminClient.rpc("approve_application", {
    _application_id: body.applicationId,
    _user_id: userId,
  });
  if (error) {
    const status = /admin/i.test(error.message) ? 403 : /pending|istnieje/i.test(error.message) ? 409 : 400;
    return json({ error: error.message }, status);
  }

  return json({ enrollmentId, userId, status: "approved" }, 201);
});
