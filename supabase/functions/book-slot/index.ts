// ============================================================================
// Edge Function: book-slot — transakcyjna rezerwacja slotu praktyki (R7, R10, R14b)
//
// Cienka warstwa wokół czystego silnika (src/engine/scheduling.ts). Kolejność:
//  1. Uwierzytelnienie i sprawdzenie, że wołający to właściciel enrollmentu/admin.
//  2. Załadowanie kontekstu (cleared_to_drive, godziny pracy instruktora,
//     dostępność kursanta, aktywne sloty) klientem service_role.
//  3. Walidacja regułowa przez przetestowane prymitywy silnika (zawieraSie/czyKoliduje).
//  4. INSERT slotu — constraint EXCLUDE (0003) to twarda gwarancja przeciw
//     double-bookingowi pod współbieżnością; kolizję tłumaczymy na HTTP 409.
//
// Układy współrzędnych czasu:
//  * godziny pracy instruktora = time-of-day (working_hours cykliczne tygodniowo)
//    → porównujemy w minutach dnia (UTC),
//  * dostępność kursanta i istniejące sloty = czas absolutny (timestamptz)
//    → porównujemy w minutach epoch.
//
// Deploy: supabase functions deploy book-slot
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  DLUGOSC_SLOTU_PRAKTYKI_MIN,
  czyKoliduje,
  zawieraSie,
  type Interwal,
} from "../../../src/engine/scheduling.ts";

interface BookSlotBody {
  enrollmentId: string;
  instructorId: string;
  startTs: string; // ISO 8601
  endTs: string; // ISO 8601
}

const naMinutyEpoch = (iso: string): number => Math.floor(Date.parse(iso) / 60000);
const minutyDniaUTC = (iso: string): number => {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const dzienTygodnia = (iso: string): number => {
  // working_hours: 0 = poniedziałek … 6 = niedziela; JS getUTCDay: 0 = niedziela
  return (new Date(iso).getUTCDay() + 6) % 7;
};
const czasNaMinuty = (t: string): number => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Brak autoryzacji" }, 401);

  let body: BookSlotBody;
  try {
    body = (await req.json()) as BookSlotBody;
  } catch {
    return json({ error: "Nieprawidłowy JSON" }, 400);
  }
  const { enrollmentId, instructorId, startTs, endTs } = body ?? {};
  if (!enrollmentId || !instructorId || !startTs || !endTs) {
    return json({ error: "Wymagane: enrollmentId, instructorId, startTs, endTs" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Tożsamość wołającego.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: "Nieuwierzytelniony" }, 401);

  // Odczyt kontekstu przez service_role (spójny, omija RLS).
  const db = createClient(url, serviceKey);

  // Uwaga: FK jest złożony (membership_id, osk_id) -> membership(id, osk_id);
  // embed po nazwie TABELI ("membership"), alias po kolumnie ("membership:membership_id")
  // nie znajduje relacji w PostgREST i zwraca błąd.
  const { data: enr, error: enrErr } = await db
    .from("enrollment")
    .select("id, osk_id, course_id, cleared_to_drive, course (h_praktyka), membership (user_id)")
    .eq("id", enrollmentId)
    .single();
  if (enrErr || !enr) return json({ error: "Nie znaleziono enrollmentu" }, 404);

  // Autoryzacja: właściciel enrollmentu lub admin OSK.
  const ownerId = (enr.membership as { user_id: string } | null)?.user_id;
  const { data: adminMembership } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", enr.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (ownerId !== uid && !adminMembership) {
    return json({ error: "Brak uprawnień do tego enrollmentu" }, 403);
  }

  // --- Walidacja regułowa (silnik) -----------------------------------------

  if (!(enr.cleared_to_drive as boolean)) {
    return json({ error: "Kursant nie jest dopuszczony do jazd (R14b)." }, 422);
  }

  // Limit godzin: kursant nigdy nie rezerwuje więcej niż h_praktyka aktywnych
  // godzin (zaplanowane+odbyte+propozycje). Musi najpierw odwołać coś innego.
  const hPraktyka = (enr.course as unknown as { h_praktyka: number } | null)?.h_praktyka ?? 0;
  const { count: aktywneGodziny } = await db
    .from("slot")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId)
    .in("status", ["zaplanowany", "odbyty", "propozycja"]);
  if ((aktywneGodziny ?? 0) >= hPraktyka) {
    return json(
      { error: `Osiągnięto limit ${hPraktyka}h. Odwołaj inny termin, żeby zarezerwować nowy.` },
      422,
    );
  }

  const slotEpoch: Interwal = { start: naMinutyEpoch(startTs), end: naMinutyEpoch(endTs) };
  if (slotEpoch.end - slotEpoch.start !== DLUGOSC_SLOTU_PRAKTYKI_MIN) {
    return json({ error: "Slot musi mieć dokładnie 1 h." }, 422);
  }

  // Godziny pracy instruktora w dniu tygodnia slotu (time-of-day).
  const { data: wh } = await db
    .from("working_hours")
    .select("od_godz, do_godz")
    .eq("instructor_id", instructorId)
    .eq("dzien_tygodnia", dzienTygodnia(startTs));
  const oknaPracy: Interwal[] = (wh ?? []).map((w) => ({
    start: czasNaMinuty(w.od_godz as string),
    end: czasNaMinuty(w.do_godz as string),
  }));
  const slotDnia: Interwal = { start: minutyDniaUTC(startTs), end: minutyDniaUTC(endTs) };
  if (!zawieraSie(slotDnia, oknaPracy)) {
    return json({ error: "Slot poza wolnym oknem instruktora." }, 422);
  }

  // Dostępność kursanta (czas absolutny).
  const { data: avail } = await db
    .from("availability")
    .select("start_ts, end_ts")
    .eq("enrollment_id", enrollmentId);
  const dostepnosc: Interwal[] = (avail ?? []).map((a) => ({
    start: naMinutyEpoch(a.start_ts as string),
    end: naMinutyEpoch(a.end_ts as string),
  }));
  if (!zawieraSie(slotEpoch, dostepnosc)) {
    return json({ error: "Slot poza zadeklarowaną dostępnością kursanta." }, 422);
  }

  // Kolizje z aktywnymi slotami (miękko; twardo pilnuje EXCLUDE przy INSERT).
  const aktywne = (rows: { start_ts: string; end_ts: string }[] | null): Interwal[] =>
    (rows ?? []).map((s) => ({ start: naMinutyEpoch(s.start_ts), end: naMinutyEpoch(s.end_ts) }));
  const { data: slotyInstr } = await db
    .from("slot")
    .select("start_ts, end_ts")
    .eq("instructor_id", instructorId)
    .in("status", ["zaplanowany", "odbyty"]);
  const { data: slotyKurs } = await db
    .from("slot")
    .select("start_ts, end_ts")
    .eq("enrollment_id", enrollmentId)
    .in("status", ["zaplanowany", "odbyty"]);
  if (czyKoliduje(slotEpoch, aktywne(slotyInstr))) {
    return json({ error: "Instruktor ma już rezerwację w tym czasie." }, 409);
  }
  if (czyKoliduje(slotEpoch, aktywne(slotyKurs))) {
    return json({ error: "Kursant ma już rezerwację w tym czasie." }, 409);
  }

  // --- INSERT (EXCLUDE = ostateczny guardrail współbieżności) ---------------
  const { data: inserted, error: insErr } = await db
    .from("slot")
    .insert({
      osk_id: enr.osk_id,
      course_id: enr.course_id,
      enrollment_id: enrollmentId,
      instructor_id: instructorId,
      start_ts: startTs,
      end_ts: endTs,
      status: "zaplanowany",
    })
    .select("id")
    .single();

  if (insErr) {
    if (insErr.code === "23P01") {
      return json({ error: "Slot został właśnie zajęty. Wybierz inny termin." }, 409);
    }
    return json({ error: insErr.message }, 400);
  }

  return json({ slotId: inserted.id, status: "zaplanowany" }, 201);
});
