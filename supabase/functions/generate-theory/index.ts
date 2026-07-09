// ============================================================================
// Edge Function: generate-theory — auto-harmonogram teorii grupowej (R6)
//
// Po zamknięciu zapisów admin wyzwala rozpisanie teorii. Cienka warstwa wokół
// generujBlokiTeorii(): rozwija tygodniowe godziny pracy wykładowców w konkretne
// okna na horyzoncie kilku tygodni, pakuje w nie h_teoria godzin lekcyjnych
// i zapisuje bloki jako theory_session.
//
// Deploy: supabase functions deploy generate-theory
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  GODZINA_TEORII_MIN,
  generujBlokiTeorii,
  rozwinGodzinyTygodniowe,
} from "../../../src/engine/scheduling.ts";

interface GenerateTheoryBody {
  courseId: string;
  /** Data startowa (ISO, opcjonalna); domyślnie najbliższy poniedziałek UTC. */
  fromDate?: string;
  /** Ile tygodni w przód rozwijać okna wykładowców. */
  horyzontTygodni?: number;
}

const MIN = 60000;
const czasNaMinuty = (t: string): number => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

// Najbliższy poniedziałek 00:00 UTC (włącznie z dziś, jeśli poniedziałek).
function najblizszyPoniedzialek(ref: Date): Date {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = poniedziałek
  d.setUTCDate(d.getUTCDate() + ((7 - dow) % 7));
  return d;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

  let body: GenerateTheoryBody;
  try {
    body = (await req.json()) as GenerateTheoryBody;
  } catch {
    return json({ error: "Nieprawidłowy JSON" }, 400);
  }
  const { courseId } = body ?? {};
  if (!courseId) return json({ error: "Wymagane: courseId" }, 400);
  const horyzont = Math.max(1, Math.min(52, body.horyzontTygodni ?? 12));

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: "Nieuwierzytelniony" }, 401);

  const db = createClient(url, serviceKey);

  const { data: course, error: cErr } = await db
    .from("course")
    .select("id, osk_id, h_teoria")
    .eq("id", courseId)
    .single();
  if (cErr || !course) return json({ error: "Nie znaleziono kursu" }, 404);

  // Autoryzacja: tylko admin OSK.
  const { data: admin } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", course.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (!admin) return json({ error: "Wymagane uprawnienia admina" }, 403);

  const hTeoria = course.h_teoria as number;
  if (hTeoria <= 0) return json({ sessions: 0, message: "Kurs nie ma godzin teorii." }, 200);

  // Sala: bierzemy tę o największej pojemności (jedna grupa = jedna sala; brak
  // sal nie blokuje generowania, po prostu grafik zostaje bez przypisania).
  const { data: sale } = await db
    .from("room")
    .select("id, pojemnosc")
    .eq("osk_id", course.osk_id)
    .order("pojemnosc", { ascending: false })
    .limit(1);
  const roomId = sale?.[0]?.id ?? null;

  // Wykładowcy przypisani do kursu (typ: wykladowca lub 2w1) i ich godziny pracy.
  // Uwaga: FK jest złożony (instructor_id, osk_id) -> instructor(id, osk_id);
  // PostgREST rozpoznaje embed po nazwie TABELI, nie po aliasie kolumny
  // (alias "instructor:instructor_id" nie znajduje relacji i zwraca błąd).
  const { data: przypisani } = await db
    .from("course_instructor")
    .select("instructor (id, typ)")
    .eq("course_id", courseId);
  const wykladowcy = (przypisani ?? [])
    .map((r) => r.instructor as { id: string; typ: string } | null)
    .filter((i): i is { id: string; typ: string } =>
      !!i && (i.typ === "wykladowca" || i.typ === "instruktor_2w1"),
    );
  if (wykladowcy.length === 0) {
    return json({ error: "Brak przypisanego wykładowcy dla kursu." }, 422);
  }

  const { data: wh } = await db
    .from("working_hours")
    .select("instructor_id, dzien_tygodnia, od_godz, do_godz")
    .in(
      "instructor_id",
      wykladowcy.map((w) => w.id),
    );
  if (!wh || wh.length === 0) {
    return json({ error: "Wykładowcy nie mają zdefiniowanych godzin pracy." }, 422);
  }

  // Rozwiń tygodniowe godziny w konkretne okna (epoch-minuty) na horyzoncie.
  const poniedzialek = najblizszyPoniedzialek(
    body.fromDate ? new Date(body.fromDate) : new Date(),
  );
  const poniedzialekEpochMin = Math.floor(poniedzialek.getTime() / MIN);
  const okna = rozwinGodzinyTygodniowe(
    wh.map((w) => ({
      dzienTygodnia: w.dzien_tygodnia as number,
      odMin: czasNaMinuty(w.od_godz as string),
      doMin: czasNaMinuty(w.do_godz as string),
    })),
    poniedzialekEpochMin,
    horyzont,
  );

  let bloki;
  try {
    bloki = generujBlokiTeorii(okna, hTeoria, GODZINA_TEORII_MIN);
  } catch (e) {
    return json({ error: (e as Error).message }, 422);
  }

  // Idempotencja: wyczyść wcześniej rozpisaną teorię kursu, wstaw nową.
  await db.from("theory_session").delete().eq("course_id", courseId);
  const rows = bloki.map((b) => ({
    osk_id: course.osk_id,
    course_id: courseId,
    start_ts: new Date(b.start * MIN).toISOString(),
    end_ts: new Date(b.end * MIN).toISOString(),
    liczba_godzin: b.liczbaGodzin,
    room_id: roomId,
  }));
  const { error: insErr } = await db.from("theory_session").insert(rows);
  if (insErr) return json({ error: insErr.message }, 400);

  return json({ sessions: rows.length, godzinyRozpisane: hTeoria }, 201);
});
