// ============================================================================
// Edge Function: submit-application — publiczne zgłoszenie z linku zapisów (R4)
//
// Cienka warstwa wokół walidacji z silnika (src/engine/onboarding.ts). Publiczna
// (kandydat nie ma konta): waliduje kompletność (wiek, zgody, pola), po czym
// zapisuje candidate_application (status pending) + ślad zgód. Maker-checker
// (approve-application) zamienia to później na enrollment.
//
// Deploy: supabase functions deploy submit-application --no-verify-jwt
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { walidujZgloszenie, type DaneZgloszenia } from "../../../src/engine/onboarding.ts";

interface Okno {
  start_ts: string;
  end_ts: string;
}
interface SubmitBody extends DaneZgloszenia {
  courseId: string;
  dostepnosc?: Okno[];
  zgodaOpiekunaTresc?: string;
  zgodaRodoTresc?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json({ error: "Nieprawidłowy JSON" }, 400);
  }
  if (!body?.courseId) return json({ error: "Wymagane: courseId" }, 400);

  // Walidacja kompletności — pojedyncze źródło reguł (silnik).
  const wynik = walidujZgloszenie(body);
  if (!wynik.ok) return json({ error: "Zgłoszenie niekompletne", braki: wynik.braki }, 422);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey);

  // Kurs musi istnieć i mieć otwarte zapisy.
  const { data: course, error: cErr } = await db
    .from("course")
    .select("id, osk_id, zapisy_otwarte")
    .eq("id", body.courseId)
    .single();
  if (cErr || !course) return json({ error: "Nie znaleziono kursu" }, 404);
  if (!course.zapisy_otwarte) return json({ error: "Zapisy na ten kurs są zamknięte" }, 409);

  const { data: app, error: aErr } = await db
    .from("candidate_application")
    .insert({
      osk_id: course.osk_id,
      course_id: body.courseId,
      imie: body.imie,
      nazwisko: body.nazwisko,
      email: body.email,
      telefon: body.telefon,
      kategoria: body.kategoria,
      pkk_number: body.pkkNumber,
      data_urodzenia: body.dataUrodzenia,
      dostepnosc: body.dostepnosc ?? [],
    })
    .select("id")
    .single();
  if (aErr || !app) return json({ error: aErr?.message ?? "Błąd zapisu zgłoszenia" }, 400);

  // Ślad zgód (audyt RODO/opiekun). Best-effort — nie blokuje zgłoszenia.
  const zgody: { osk_id: string; application_id: string; typ: string; tresc: string | null }[] = [];
  if (body.zgodaRodo) {
    zgody.push({ osk_id: course.osk_id, application_id: app.id, typ: "rodo", tresc: body.zgodaRodoTresc ?? null });
  }
  if (body.zgodaOpiekuna) {
    zgody.push({ osk_id: course.osk_id, application_id: app.id, typ: "opiekun", tresc: body.zgodaOpiekunaTresc ?? null });
  }
  if (zgody.length > 0) await db.from("consent").insert(zgody);

  return json({ applicationId: app.id, status: "pending" }, 201);
});
