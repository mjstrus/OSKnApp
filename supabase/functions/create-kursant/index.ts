// ============================================================================
// Edge Function: create-kursant — admin zakłada konto kursanta z hasłem
// i zapisuje go na kurs (do testów / szybkiego onboardingu poza formularzem).
//
// Deploy: supabase functions deploy create-kursant
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

interface Body {
  email: string;
  password: string;
  courseId: string;
  clearedToDrive?: boolean;
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
  const { email, password, courseId } = body ?? {};
  if (!email || !password || !courseId) {
    return json({ error: "Wymagane: email, password, courseId" }, 400);
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

  const { data: course, error: cErr } = await db
    .from("course")
    .select("id, osk_id")
    .eq("id", courseId)
    .single();
  if (cErr || !course) return json({ error: "Nie znaleziono kursu" }, 404);

  const { data: adminM } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", course.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (!adminM) return json({ error: "Wymagane uprawnienia admina" }, 403);

  let userId: string | undefined;
  const { data: created, error: uErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else if (uErr) {
    const { data: list } = await db.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === email)?.id;
    if (userId) await db.auth.admin.updateUserById(userId, { password });
  }
  if (!userId) return json({ error: "Nie udało się utworzyć konta" }, 400);

  let membershipId: string;
  const { data: istn } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", course.osk_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (istn) {
    membershipId = istn.id as string;
  } else {
    const { data: m, error: mErr } = await db
      .from("membership")
      .insert({ osk_id: course.osk_id, user_id: userId, rola: "kursant" })
      .select("id")
      .single();
    if (mErr || !m) return json({ error: mErr?.message ?? "Błąd membership" }, 400);
    membershipId = m.id as string;
  }

  const { data: enrIstn } = await db
    .from("enrollment")
    .select("id")
    .eq("course_id", courseId)
    .eq("membership_id", membershipId)
    .maybeSingle();
  let enrollmentId = enrIstn?.id as string | undefined;
  if (!enrollmentId) {
    const { data: enr, error: eErr } = await db
      .from("enrollment")
      .insert({
        osk_id: course.osk_id,
        course_id: courseId,
        membership_id: membershipId,
        cleared_to_drive: body.clearedToDrive ?? false,
      })
      .select("id")
      .single();
    if (eErr || !enr) return json({ error: eErr?.message ?? "Błąd enrollmentu" }, 400);
    enrollmentId = enr.id as string;
  }

  return json({ userId, membershipId, enrollmentId }, 201);
});
