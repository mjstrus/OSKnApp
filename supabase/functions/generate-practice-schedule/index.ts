// ============================================================================
// Edge Function: generate-practice-schedule — auto-przydział jazd praktycznych
//
// Admin wyzwala razem z (lub po) generate-theory. Dla każdego zapisanego
// kursanta dobiera 1h sloty jazd wg zadeklarowanej dostępności i wolnych okien
// instruktorów praktyki (silnik: dopasujGrafikPraktyki). Wynik to PROPOZYCJE
// (status 'propozycja', confirm_by = now()+48h) — kursant potwierdza/odwołuje
// w swoim panelu; nieodwołane po terminie i odwołane trafiają do giełdy.
//
// Deploy: supabase functions deploy generate-practice-schedule
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { odejmij, rozwinGodzinyTygodniowe } from "../../../src/engine/scheduling.ts";
import { dopasujGrafikPraktyki } from "../../../src/engine/practiceMatching.ts";
import { wyslijEmail } from "../_shared/email.ts";

interface Body {
  courseId: string;
  fromDate?: string;
  horyzontTygodni?: number;
  /** Ile godzin ma kursant na potwierdzenie/odwołanie propozycji. */
  godzinNaPotwierdzenie?: number;
}

const MIN = 60000;
const czasNaMinuty = (t: string): number => {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
};

function najblizszyPoniedzialek(ref: Date): Date {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() + ((7 - dow) % 7));
  return d;
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
  const { courseId } = body ?? {};
  if (!courseId) return json({ error: "Wymagane: courseId" }, 400);
  const horyzont = Math.max(1, Math.min(52, body.horyzontTygodni ?? 12));
  const godzinNaPotwierdzenie = Math.max(1, body.godzinNaPotwierdzenie ?? 48);

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
    .select("id, osk_id, h_praktyka")
    .eq("id", courseId)
    .single();
  if (cErr || !course) return json({ error: "Nie znaleziono kursu" }, 404);

  const { data: admin } = await db
    .from("membership")
    .select("id")
    .eq("osk_id", course.osk_id)
    .eq("user_id", uid)
    .eq("rola", "admin")
    .maybeSingle();
  if (!admin) return json({ error: "Wymagane uprawnienia admina" }, 403);

  const hPraktyka = course.h_praktyka as number;
  if (hPraktyka <= 0) {
    return json({ przydzielono: 0, niedoprzydzieleni: [], message: "Kurs nie ma godzin praktyki." }, 200);
  }

  // Wygaś przeterminowane propozycje z innych kursów tego OSK — zwalnia okna
  // instruktorów przed nowym dopasowaniem.
  await db.rpc("wygas_propozycje_praktyki");

  // Instruktorzy praktyki (typ != wykladowca) przypisani do kursu + ich godziny pracy.
  const { data: przypisani } = await db
    .from("course_instructor")
    .select("instructor (id, typ)")
    .eq("course_id", courseId);
  const instruktorzyPraktyki = (przypisani ?? [])
    .map((r) => r.instructor as { id: string; typ: string } | null)
    .filter((i): i is { id: string; typ: string } => !!i && i.typ !== "wykladowca");
  if (instruktorzyPraktyki.length === 0) {
    return json({ error: "Brak przypisanego instruktora praktyki dla kursu." }, 422);
  }
  const idyInstruktorow = instruktorzyPraktyki.map((i) => i.id);

  const { data: wh } = await db
    .from("working_hours")
    .select("instructor_id, dzien_tygodnia, od_godz, do_godz")
    .in("instructor_id", idyInstruktorow);
  if (!wh || wh.length === 0) {
    return json({ error: "Instruktorzy praktyki nie mają zdefiniowanych godzin pracy." }, 422);
  }

  const poniedzialek = najblizszyPoniedzialek(body.fromDate ? new Date(body.fromDate) : new Date());
  const poniedzialekEpochMin = Math.floor(poniedzialek.getTime() / MIN);

  // Aktywne sloty instruktorów praktyki (już zajęte okna, do odjęcia).
  const { data: zajeteInstr } = await db
    .from("slot")
    .select("instructor_id, start_ts, end_ts")
    .in("instructor_id", idyInstruktorow)
    .in("status", ["zaplanowany", "odbyty", "propozycja", "wolny_gielda"]);

  const instruktorzy = instruktorzyPraktyki.map((i) => {
    const oknaPracy = rozwinGodzinyTygodniowe(
      (wh ?? [])
        .filter((w) => w.instructor_id === i.id)
        .map((w) => ({
          dzienTygodnia: w.dzien_tygodnia as number,
          odMin: czasNaMinuty(w.od_godz as string),
          doMin: czasNaMinuty(w.do_godz as string),
        })),
      poniedzialekEpochMin,
      horyzont,
    );
    const zajete = (zajeteInstr ?? [])
      .filter((s) => s.instructor_id === i.id)
      .map((s) => ({
        start: Math.floor(Date.parse(s.start_ts as string) / MIN),
        end: Math.floor(Date.parse(s.end_ts as string) / MIN),
      }));
    return { instructorId: i.id, wolneOkna: odejmij(oknaPracy, zajete) };
  });

  // Kursanci zapisani na kurs + ich zadeklarowana dostępność + już przydzielone godziny.
  const { data: enrollmenty } = await db
    .from("enrollment")
    .select("id")
    .eq("course_id", courseId);
  const idyEnrollment = (enrollmenty ?? []).map((e) => e.id as string);
  if (idyEnrollment.length === 0) {
    return json({ przydzielono: 0, niedoprzydzieleni: [], message: "Brak zapisanych kursantów." }, 200);
  }

  const { data: dostepnoscRows } = await db
    .from("availability")
    .select("enrollment_id, start_ts, end_ts")
    .in("enrollment_id", idyEnrollment);
  const { data: aktywneSlotyKurs } = await db
    .from("slot")
    .select("enrollment_id, status")
    .in("enrollment_id", idyEnrollment)
    .in("status", ["zaplanowany", "odbyty", "propozycja"]);

  const kursanci = idyEnrollment.map((enrollmentId) => {
    const dostepnosc = (dostepnoscRows ?? [])
      .filter((a) => a.enrollment_id === enrollmentId)
      .map((a) => ({
        start: Math.floor(Date.parse(a.start_ts as string) / MIN),
        end: Math.floor(Date.parse(a.end_ts as string) / MIN),
      }));
    const jużMa = (aktywneSlotyKurs ?? []).filter((s) => s.enrollment_id === enrollmentId).length;
    return { enrollmentId, potrzebneGodziny: Math.max(0, hPraktyka - jużMa), dostepnosc };
  });

  const { przydzielone, niedoprzydzieleni } = dopasujGrafikPraktyki(kursanci, instruktorzy);

  if (przydzielone.length === 0) {
    return json({ przydzielono: 0, niedoprzydzieleni, message: "Nic nie dopasowano." }, 200);
  }

  const confirmBy = new Date(Date.now() + godzinNaPotwierdzenie * 3_600_000).toISOString();
  const rows = przydzielone.map((p) => ({
    osk_id: course.osk_id,
    course_id: courseId,
    enrollment_id: p.enrollmentId,
    instructor_id: p.instructorId,
    start_ts: new Date(p.start * MIN).toISOString(),
    end_ts: new Date(p.end * MIN).toISOString(),
    status: "propozycja",
    confirm_by: confirmBy,
  }));
  const { error: insErr } = await db.from("slot").insert(rows);
  if (insErr) return json({ error: insErr.message }, 400);

  await powiadomKursantow(db, przydzielone, confirmBy);

  return json({ przydzielono: rows.length, niedoprzydzieleni }, 201);
});

/**
 * E-mail do każdego kursanta z nową propozycją jazd. Best-effort — brak klucza
 * albo błąd wysyłki nie blokuje wyniku generowania.
 * ponytail: brak przypomnienia "zbliża się termin" — wymagałoby crona (brak
 * infra); dodać przez pg_cron + osobną funkcję, jeśli to zacznie boleć.
 */
async function powiadomKursantow(
  // deno-lint-ignore no-explicit-any
  db: any,
  przydzielone: { enrollmentId: string }[],
  confirmBy: string,
): Promise<void> {
  const liczbaPerEnrollment = new Map<string, number>();
  for (const p of przydzielone) {
    liczbaPerEnrollment.set(p.enrollmentId, (liczbaPerEnrollment.get(p.enrollmentId) ?? 0) + 1);
  }
  const enrollmentIds = [...liczbaPerEnrollment.keys()];

  const { data: enrollmenty } = await db
    .from("enrollment")
    .select("id, membership_id")
    .in("id", enrollmentIds);
  const membershipIds = (enrollmenty ?? []).map((e: { membership_id: string }) => e.membership_id);
  const { data: membershipy } = await db
    .from("membership")
    .select("id, user_id")
    .in("id", membershipIds);

  const terminPL = new Date(confirmBy).toLocaleString("pl-PL");

  for (const enr of enrollmenty ?? []) {
    const czlonek = (membershipy ?? []).find(
      (m: { id: string }) => m.id === enr.membership_id,
    ) as { user_id: string } | undefined;
    if (!czlonek) continue;
    const { data: user } = await db.auth.admin.getUserById(czlonek.user_id);
    const email = user?.user?.email;
    if (!email) continue;

    const liczba = liczbaPerEnrollment.get(enr.id) ?? 0;
    await wyslijEmail(
      email,
      "Nowe terminy jazd do potwierdzenia",
      `<p>Masz ${liczba} nowych propozycji terminów jazd praktycznych.</p>
       <p>Potwierdź lub odwołaj w panelu kursanta do <b>${terminPL}</b> — po tym czasie termin trafi do giełdy.</p>`,
    );
  }
}
