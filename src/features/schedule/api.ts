import { supabase } from "@/lib/supabase";
import type { TheorySessionZKursem } from "@/features/admin/api";
import { stanPoczatkowy, zastosujSekwencje } from "@/engine/hours";
import type { StanKursanta } from "@/engine/types";
import { wolneSlotyKursanta, zajeteZeSlotow, type GodzinyPracy, type OknoISO } from "./availability";
import { STATUS_NA_ROZLICZENIE, type SlotDoRezerwacji, type SlotView } from "./types";

export interface KursantContext {
  enrollmentId: string;
  courseId: string;
  kategoria: string;
  clearedToDrive: boolean;
  stan: StanKursanta;
  mojeSloty: SlotView[];
  dostepneSloty: SlotDoRezerwacji[];
}

/** Fold statusów slotów na stan liczników przez silnik (Unit 2). */
function stanZeSlotow(hPraktyka: number, sloty: SlotView[]): StanKursanta {
  const rozliczenia = sloty
    .filter((s) => s.status !== "zaplanowany")
    .map((s) => STATUS_NA_ROZLICZENIE[s.status as Exclude<SlotView["status"], "zaplanowany">]);
  try {
    return zastosujSekwencje(stanPoczatkowy(hPraktyka), rozliczenia);
  } catch {
    // Dane niespójne (potwierdzenia ponad pulę) — degraduj do samego licznika.
    const potwierdzone = sloty.filter((s) => s.status === "odbyty").length;
    return { ...stanPoczatkowy(hPraktyka), potwierdzone };
  }
}

/** Statusy relevantne dla licznika godzin/BookingView (bez propozycji/giełdy). */
const STATUSY_ROZLICZALNE = [
  "zaplanowany",
  "odbyty",
  "odwolany_w_oknie",
  "usprawiedliwiony",
  "nieusprawiedliwiony",
] as const;

export async function getKursantContext(oskId: string): Promise<KursantContext | null> {
  // Wygaś przeterminowane propozycje jazd sprzed tej wizyty (leniwie, bez crona).
  await supabase.rpc("wygas_propozycje_praktyki");

  // Własny enrollment (RLS: kursant widzi tylko swój). Uwaga: FK złożony
  // (course_id, osk_id) -> course(id, osk_id); embed po nazwie TABELI, nie po
  // aliasie kolumny (PostgREST inaczej nie znajduje relacji).
  const { data: enr } = await supabase
    .from("enrollment")
    .select("id, course_id, cleared_to_drive, course (h_praktyka, kategoria)")
    .eq("osk_id", oskId)
    .limit(1)
    .maybeSingle();
  if (!enr) return null;

  const kurs = enr.course as unknown as { h_praktyka: number; kategoria: string } | null;
  const hPraktyka = kurs?.h_praktyka ?? 30;
  const kategoria = kurs?.kategoria ?? "B";

  const { data: sloty } = await supabase
    .from("slot")
    .select("id, start_ts, end_ts, status, instructor_id")
    .eq("enrollment_id", enr.id)
    .in("status", STATUSY_ROZLICZALNE)
    .order("start_ts");
  const mojeSloty = (sloty ?? []) as SlotView[];

  // Instruktorzy kursu + ich godziny pracy → wolne sloty (R7).
  const { data: przypisani } = await supabase
    .from("course_instructor")
    .select("instructor_id")
    .eq("course_id", enr.course_id);
  const instruktorzy = (przypisani ?? []).map((r) => r.instructor_id as string);

  const { data: avail } = await supabase
    .from("availability")
    .select("start_ts, end_ts")
    .eq("enrollment_id", enr.id);
  const dostepnosc = (avail ?? []) as OknoISO[];

  const dostepneSloty: SlotDoRezerwacji[] = [];
  if (enr.cleared_to_drive && instruktorzy.length > 0) {
    const { data: wh } = await supabase
      .from("working_hours")
      .select("instructor_id, dzien_tygodnia, od_godz, do_godz")
      .in("instructor_id", instruktorzy);
    for (const instructorId of instruktorzy) {
      const godzinyPracy = (wh ?? []).filter(
        (w) => w.instructor_id === instructorId,
      ) as (GodzinyPracy & { instructor_id: string })[];
      const zajeteInstr = zajeteZeSlotow(
        mojeSloty.filter((s) => s.instructor_id === instructorId),
      );
      dostepneSloty.push(
        ...wolneSlotyKursanta({
          instructorId,
          godzinyPracy,
          zajeteSloty: zajeteInstr,
          dostepnoscKursanta: dostepnosc,
        }),
      );
    }
  }

  return {
    enrollmentId: enr.id,
    courseId: enr.course_id,
    kategoria,
    clearedToDrive: !!enr.cleared_to_drive,
    stan: stanZeSlotow(hPraktyka, mojeSloty),
    mojeSloty,
    dostepneSloty,
  };
}

export async function bookSlot(payload: {
  enrollmentId: string;
  instructorId: string;
  startTs: string;
  endTs: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke("book-slot", { body: payload });
  if (error) throw error;
}

export async function cancelSlot(slotId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("cancel-slot", { body: { slotId } });
  if (error) throw error;
}

/** Id rekordu instruktora dla zalogowanego użytkownika w danym OSK. */
export async function getMyInstructorId(oskId: string): Promise<string | null> {
  // Uwaga: FK złożony (membership_id, osk_id) -> membership(id, osk_id); embed
  // po nazwie tabeli, nie po aliasie kolumny.
  const { data } = await supabase
    .from("instructor")
    .select("id, membership (user_id)")
    .eq("osk_id", oskId);
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const mine = (data ?? []).find(
    (i) => (i.membership as unknown as { user_id: string } | null)?.user_id === uid,
  );
  return (mine?.id as string) ?? null;
}

export async function getInstructorSlots(instructorId: string): Promise<SlotView[]> {
  const { data, error } = await supabase
    .from("slot")
    .select("id, start_ts, end_ts, status, instructor_id, enrollment_id")
    .eq("instructor_id", instructorId)
    .in("status", STATUSY_ROZLICZALNE)
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as SlotView[];
}

/** Prywatny scoring instruktora (R18) — instruktor może dodać, nie może odczytać (RLS). */
export async function submitInstructorFeedback(params: {
  oskId: string;
  instructorId: string;
  enrollmentId?: string;
  slotId: string;
  ocena: number;
  komentarz: string;
}): Promise<void> {
  const { error } = await supabase.from("instructor_feedback").insert({
    osk_id: params.oskId,
    instructor_id: params.instructorId,
    enrollment_id: params.enrollmentId ?? null,
    slot_id: params.slotId,
    ocena: params.ocena,
    komentarz: params.komentarz || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Auto-przydział praktyki: propozycje kursanta + giełda wolnych terminów
// ---------------------------------------------------------------------------

export interface PropozycjaJazdy {
  id: string;
  start_ts: string;
  end_ts: string;
  instructor_id: string;
  confirm_by: string;
}

export async function getMyProposals(enrollmentId: string): Promise<PropozycjaJazdy[]> {
  const { data, error } = await supabase
    .from("slot")
    .select("id, start_ts, end_ts, instructor_id, confirm_by")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "propozycja")
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as PropozycjaJazdy[];
}

export async function respondToProposal(
  slotId: string,
  action: "potwierdz" | "odwolaj",
): Promise<void> {
  const { error } = await supabase.functions.invoke("respond-to-practice-proposal", {
    body: { slotId, action },
  });
  if (error) throw error;
}

export interface OfertaGieldy {
  id: string;
  start_ts: string;
  end_ts: string;
  instructor_id: string;
}

export async function listGielda(courseId: string): Promise<OfertaGieldy[]> {
  const { data, error } = await supabase
    .from("slot")
    .select("id, start_ts, end_ts, instructor_id")
    .eq("course_id", courseId)
    .eq("status", "wolny_gielda")
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as OfertaGieldy[];
}

export async function claimGieldaSlot(slotId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("claim-gielda-slot", { body: { slotId } });
  if (error) throw error;
}

/** Sloty giełdy, do których kursant już zgłosił zainteresowanie (czeka na admina). */
export async function listMyGieldaZgloszenia(enrollmentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("gielda_zgloszenie")
    .select("slot_id")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "oczekuje");
  if (error) throw error;
  return (data ?? []).map((z) => z.slot_id as string);
}

// ---------------------------------------------------------------------------
// Dostępność kursanta (edycja po zapisie — RLS: właściciel enrollmentu)
// ---------------------------------------------------------------------------

export interface OknoDostepnosciRow {
  id: string;
  start_ts: string;
  end_ts: string;
}

export async function listMyAvailability(enrollmentId: string): Promise<OknoDostepnosciRow[]> {
  const { data, error } = await supabase
    .from("availability")
    .select("id, start_ts, end_ts")
    .eq("enrollment_id", enrollmentId)
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as OknoDostepnosciRow[];
}

export async function addAvailability(
  oskId: string,
  enrollmentId: string,
  okna: { start_ts: string; end_ts: string }[],
): Promise<void> {
  const rows = okna.map((o) => ({ osk_id: oskId, enrollment_id: enrollmentId, ...o }));
  const { error } = await supabase.from("availability").insert(rows);
  if (error) throw error;
}

export async function deleteAvailability(id: string): Promise<void> {
  const { error } = await supabase.from("availability").delete().eq("id", id);
  if (error) throw error;
}

export async function confirmAttendance(slotId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("confirm-attendance", { body: { slotId } });
  if (error) throw error;
}

/** Zgłoszenie instruktora do admina (urlop/problem/zmiana grafiku). */
export async function submitInstructorRequest(params: {
  oskId: string;
  instructorId: string;
  typ: string;
  tresc: string;
}): Promise<void> {
  const { error } = await supabase.from("instructor_request").insert({
    osk_id: params.oskId,
    instructor_id: params.instructorId,
    typ: params.typ,
    tresc: params.tresc,
  });
  if (error) throw error;
}

export interface InstructorRequestRow {
  id: string;
  typ: string;
  tresc: string;
  status: string;
  created_at: string;
}

/** Historia własnych zgłoszeń — RLS już pozwala (instructor_request_own_select). */
export async function listMyInstructorRequests(instructorId: string): Promise<InstructorRequestRow[]> {
  const { data, error } = await supabase
    .from("instructor_request")
    .select("id, typ, tresc, status, created_at")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstructorRequestRow[];
}

/** Grafik wykładowcy — wykłady kursów, do których jest przypisany (course_instructor). */
export async function getInstructorTheorySessions(instructorId: string): Promise<TheorySessionZKursem[]> {
  const { data: przypisania, error: e1 } = await supabase
    .from("course_instructor")
    .select("course_id")
    .eq("instructor_id", instructorId);
  if (e1) throw e1;
  const courseIds = [...new Set((przypisania ?? []).map((p) => p.course_id as string))];
  if (courseIds.length === 0) return [];

  const { data, error } = await supabase
    .from("theory_session")
    .select("id, start_ts, end_ts, liczba_godzin, room (nazwa, adres), course (nazwa)")
    .in("course_id", courseIds)
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as unknown as TheorySessionZKursem[];
}

// ---------------------------------------------------------------------------
// RODO — eksport/usunięcie własnych danych (RPC scoped do auth.uid()).
// ---------------------------------------------------------------------------

export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc("eksportuj_moje_dane");
  if (error) throw error;
  return data;
}

export async function deleteMyData(oskId: string): Promise<void> {
  const { error } = await supabase.rpc("usun_moje_dane", { _osk_id: oskId });
  if (error) throw error;
}
