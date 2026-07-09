// ============================================================================
// Edge Function: send-reminders — przypomnienie e-mail o jeździe w ciągu 24h.
//
// Wołana co godzinę przez pg_cron (net.http_post, patrz migracja 0016) —
// --no-verify-jwt, bo cron nie ma sesji użytkownika. slot.przypomnienie_wyslano
// pilnuje żeby nie wysłać dwa razy.
//
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { wyslijEmail } from "../_shared/email.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const teraz = new Date();
  const za24h = new Date(teraz.getTime() + 24 * 60 * 60 * 1000);

  const { data: sloty, error } = await db
    .from("slot")
    .select("id, start_ts, instructor_id, enrollment_id")
    .eq("status", "zaplanowany")
    .eq("przypomnienie_wyslano", false)
    .gte("start_ts", teraz.toISOString())
    .lte("start_ts", za24h.toISOString());
  if (error) return json({ error: error.message }, 500);
  if (!sloty || sloty.length === 0) return json({ wyslano: 0 });

  async function emailCzlonka(membershipId: string): Promise<string | null> {
    const { data: czlonek } = await db.from("membership").select("user_id").eq("id", membershipId).maybeSingle();
    if (!czlonek) return null;
    const { data: user } = await db.auth.admin.getUserById(czlonek.user_id as string);
    return user?.user?.email ?? null;
  }

  let wyslano = 0;
  for (const s of sloty) {
    const [{ data: enr }, { data: instr }] = await Promise.all([
      db.from("enrollment").select("membership_id").eq("id", s.enrollment_id).maybeSingle(),
      db.from("instructor").select("membership_id").eq("id", s.instructor_id).maybeSingle(),
    ]);

    const kiedy = new Date(s.start_ts).toLocaleString("pl-PL");
    for (const membershipId of [enr?.membership_id, instr?.membership_id]) {
      if (!membershipId) continue;
      const email = await emailCzlonka(membershipId as string);
      if (!email) continue;
      await wyslijEmail(
        email,
        "Przypomnienie: jazda za mniej niż 24h",
        `<p>Masz zaplanowaną jazdę: <strong>${kiedy}</strong>.</p>`,
      );
    }

    await db.from("slot").update({ przypomnienie_wyslano: true }).eq("id", s.id);
    wyslano++;
  }

  return json({ wyslano });
});
