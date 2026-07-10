import { supabase } from "@/lib/supabase";
import type { ZasobyOsk } from "@/engine/capacity";
import type { DaneKursu } from "./CourseForm";

// ---------------------------------------------------------------------------
// Audit log akcji admina — kto i kiedy zatwierdził/usunął (dla sporów z klientem).
// ---------------------------------------------------------------------------

let cachedOskId: string | null = null;

async function mojOskId(): Promise<string | null> {
  if (cachedOskId) return cachedOskId;
  const { data } = await supabase.from("membership").select("osk_id").limit(1).maybeSingle();
  cachedOskId = (data?.osk_id as string | undefined) ?? null;
  return cachedOskId;
}

/** Fire-and-forget: logowanie nigdy nie blokuje ani nie wywraca głównej akcji. */
async function logujAkcje(akcja: string, szczegoly?: Record<string, unknown>): Promise<void> {
  const oskId = await mojOskId();
  if (!oskId) return;
  await supabase
    .from("admin_audit_log")
    .insert({ osk_id: oskId, akcja, szczegoly: szczegoly ?? null })
    .then(
      () => {},
      () => {},
    );
}

export interface KursRow {
  id: string;
  nazwa: string;
  kategoria: string;
  h_teoria: number;
  h_praktyka: number;
  zapisy_otwarte: boolean;
  data_poczatku: string | null;
  docelowy_czas_dni: number | null;
  min_uczestnicy: number;
  max_uczestnicy: number | null;
}

export interface ZgloszenieRow {
  id: string;
  imie: string;
  nazwisko: string;
  email: string;
  status: string;
  course_id: string;
}

export async function listCourses(oskId: string): Promise<KursRow[]> {
  const { data, error } = await supabase
    .from("course")
    .select(
      "id, nazwa, kategoria, h_teoria, h_praktyka, zapisy_otwarte, data_poczatku, docelowy_czas_dni, min_uczestnicy, max_uczestnicy",
    )
    .eq("osk_id", oskId)
    .order("nazwa");
  if (error) throw error;
  return (data ?? []) as KursRow[];
}

export async function getCourse(courseId: string): Promise<KursRow | null> {
  const { data, error } = await supabase
    .from("course")
    .select(
      "id, nazwa, kategoria, h_teoria, h_praktyka, zapisy_otwarte, data_poczatku, docelowy_czas_dni, min_uczestnicy, max_uczestnicy",
    )
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data as KursRow | null;
}

export async function addCourse(oskId: string, d: DaneKursu): Promise<void> {
  const { error } = await supabase.from("course").insert({ osk_id: oskId, ...d });
  if (error) throw error;
}

export interface WorkingHoursRow {
  id: string;
  dzien_tygodnia: number;
  od_godz: string;
  do_godz: string;
}

/** Dodaje godziny pracy dla WIELU dni naraz (jeden zakres godzin, kilka dni). */
export async function addWorkingHours(
  oskId: string,
  instructorId: string,
  dni: number[],
  od_godz: string,
  do_godz: string,
): Promise<void> {
  const rows = dni.map((dzien_tygodnia) => ({
    osk_id: oskId,
    instructor_id: instructorId,
    dzien_tygodnia,
    od_godz,
    do_godz,
  }));
  const { error } = await supabase.from("working_hours").insert(rows);
  if (error) throw error;
}

export async function listWorkingHours(instructorId: string): Promise<WorkingHoursRow[]> {
  const { data, error } = await supabase
    .from("working_hours")
    .select("id, dzien_tygodnia, od_godz, do_godz")
    .eq("instructor_id", instructorId)
    .order("dzien_tygodnia");
  if (error) throw error;
  return (data ?? []) as WorkingHoursRow[];
}

export async function deleteWorkingHours(id: string): Promise<void> {
  const { error } = await supabase.from("working_hours").delete().eq("id", id);
  if (error) throw error;
}

/** Zamknięcie zapisów (R6): tylko wyłącza formularz. Grafik generuje się osobno. */
export async function closeEnrollment(courseId: string): Promise<void> {
  const { error } = await supabase
    .from("course")
    .update({ zapisy_otwarte: false })
    .eq("id", courseId);
  if (error) throw error;
  void logujAkcje("zamkniecie_zapisow", { courseId });
}

/** Generuje/przegenerowuje grafik teorii (R6) — osobny krok po zamknięciu zapisów. */
export async function generateTheorySchedule(courseId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke("generate-theory", {
    body: { courseId },
  });
  if (error) throw error;
  return (data as { sessions?: number })?.sessions ?? 0;
}

export interface WynikGrafikuPraktyki {
  przydzielono: number;
  niedoprzydzieleni: { enrollmentId: string; brakujeGodzin: number }[];
  message?: string;
}

/** Auto-przydział propozycji jazd praktycznych (osobny krok od grafiku teorii). */
export async function generatePracticeSchedule(courseId: string): Promise<WynikGrafikuPraktyki> {
  const { data, error } = await supabase.functions.invoke("generate-practice-schedule", {
    body: { courseId },
  });
  if (error) throw error;
  return data as WynikGrafikuPraktyki;
}

export interface TheorySessionRow {
  id: string;
  start_ts: string;
  end_ts: string;
  liczba_godzin: number;
  room: { nazwa: string; adres: string | null } | null;
}

export async function listTheorySessions(courseId: string): Promise<TheorySessionRow[]> {
  const { data, error } = await supabase
    .from("theory_session")
    .select("id, start_ts, end_ts, liczba_godzin, room (nazwa, adres)")
    .eq("course_id", courseId)
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as unknown as TheorySessionRow[];
}

export interface TheorySessionZKursem extends TheorySessionRow {
  course: { nazwa: string } | null;
}

/** Grafik teorii wszystkich kursów OSK — do centralnego kalendarza admina. */
export async function listAllTheorySessions(oskId: string): Promise<TheorySessionZKursem[]> {
  const { data, error } = await supabase
    .from("theory_session")
    .select("id, start_ts, end_ts, liczba_godzin, room (nazwa, adres), course (nazwa)")
    .eq("osk_id", oskId)
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as unknown as TheorySessionZKursem[];
}

export async function listApplications(oskId: string): Promise<ZgloszenieRow[]> {
  const { data, error } = await supabase
    .from("candidate_application")
    .select("id, imie, nazwisko, email, status, course_id")
    .eq("osk_id", oskId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ZgloszenieRow[];
}

export async function approveApplication(applicationId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("approve-application", {
    body: { applicationId },
  });
  if (error) throw error;
  void logujAkcje("zatwierdzenie_zgloszenia", { applicationId });
}

export interface InstruktorRow {
  id: string;
  typ: string;
  aktywny: boolean;
  imie: string | null;
  nazwisko: string | null;
  numer_legitymacji: string | null;
}

export interface EnrollmentRow {
  id: string;
  membership_id: string;
  cleared_to_drive: boolean;
  payment_status: string;
}

/** Dodaje personel (konto + membership + instruktor) przez Edge Function. */
export async function createStaff(payload: {
  email: string;
  rola: "instruktor" | "wykladowca" | "instruktor_2w1";
  imie: string;
  nazwisko: string;
  numerLegitymacji: string;
}): Promise<void> {
  const redirectTo = `${window.location.origin}/reset-hasla`;
  const { error } = await supabase.functions.invoke("create-staff", {
    body: { ...payload, redirectTo },
  });
  if (error) throw error;
}

export async function listInstructors(oskId: string): Promise<InstruktorRow[]> {
  const { data, error } = await supabase
    .from("instructor")
    .select("id, typ, aktywny, imie, nazwisko, numer_legitymacji")
    .eq("osk_id", oskId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as InstruktorRow[];
}

export async function getInstructor(id: string): Promise<InstruktorRow | null> {
  const { data, error } = await supabase
    .from("instructor")
    .select("id, typ, aktywny, imie, nazwisko, numer_legitymacji")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as InstruktorRow | null;
}

/** Ustawienia dostępu: aktywny=false blokuje logowanie do OSK (RLS is_member_of po membership zostaje — świadomie prosty przełącznik, nie usuwa konta). */
export async function setInstructorActive(id: string, aktywny: boolean): Promise<void> {
  const { error } = await supabase.from("instructor").update({ aktywny }).eq("id", id);
  if (error) throw error;
  void logujAkcje("zmiana_aktywnosci_instruktora", { instructorId: id, aktywny });
}

/** Nowy jednorazowy link logowania na istniejący e-mail (bez tworzenia konta od nowa). */
export async function resendAccessLink(instructorId: string): Promise<string> {
  const redirectTo = `${window.location.origin}/reset-hasla`;
  const { data, error } = await supabase.functions.invoke("resend-access-link", {
    body: { instructorId, redirectTo },
  });
  if (error) throw error;
  void logujAkcje("wyslanie_linku_dostepu", { instructorId });
  return (data as { email: string }).email;
}

export interface InstructorRequestSimple {
  id: string;
  typ: string;
  tresc: string;
  status: string;
  created_at: string;
}

export async function listInstructorRequestsFor(instructorId: string): Promise<InstructorRequestSimple[]> {
  const { data, error } = await supabase
    .from("instructor_request")
    .select("id, typ, tresc, status, created_at")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstructorRequestSimple[];
}

export async function getInstructorScore(
  instructorId: string,
): Promise<{ srednia: number; liczba: number } | null> {
  const { data, error } = await supabase
    .from("instructor_feedback")
    .select("ocena")
    .eq("instructor_id", instructorId);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const suma = data.reduce((s, r) => s + (r.ocena as number), 0);
  return { srednia: suma / data.length, liczba: data.length };
}

/**
 * Usuwa instruktora (kaskadowo: godziny pracy, przypisania do kursów, sloty —
 * FK `on delete cascade` z 0001/0003/0005). Nie usuwa konta auth.
 */
export async function deleteInstructor(id: string): Promise<void> {
  const { error } = await supabase.from("instructor").delete().eq("id", id);
  if (error) throw error;
  void logujAkcje("usuniecie_instruktora", { instructorId: id });
}

export async function assignInstructorToCourse(
  oskId: string,
  courseId: string,
  instructorId: string,
): Promise<void> {
  const { error } = await supabase
    .from("course_instructor")
    .insert({ osk_id: oskId, course_id: courseId, instructor_id: instructorId });
  if (error) throw error;
}

export async function listEnrollments(courseId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from("enrollment")
    .select("id, membership_id, cleared_to_drive, payment_status")
    .eq("course_id", courseId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as EnrollmentRow[];
}

export async function updatePayment(
  enrollmentId: string,
  payment_status: "nieoplacony" | "czesciowo" | "oplacony",
): Promise<void> {
  const { error } = await supabase
    .from("enrollment")
    .update({ payment_status })
    .eq("id", enrollmentId);
  if (error) throw error;
  void logujAkcje("zmiana_platnosci", { enrollmentId, payment_status });
}

/** Agregacja prywatnego scoringu instruktorów (R18); RLS zwraca dane tylko adminowi. */
export async function fetchInstructorScores(oskId: string) {
  const [{ data: feedback, error }, instruktorzy] = await Promise.all([
    supabase.from("instructor_feedback").select("instructor_id, ocena").eq("osk_id", oskId),
    listInstructors(oskId),
  ]);
  if (error) throw error;
  const nazwy = new Map(instruktorzy.map((i) => [i.id, `${i.imie ?? ""} ${i.nazwisko ?? ""}`.trim()]));

  const agg = new Map<string, { suma: number; liczba: number }>();
  for (const r of feedback ?? []) {
    const id = r.instructor_id as string;
    const a = agg.get(id) ?? { suma: 0, liczba: 0 };
    a.suma += r.ocena as number;
    a.liczba += 1;
    agg.set(id, a);
  }
  return [...agg.entries()].map(([instructorId, a]) => ({
    instructorId,
    etykieta: nazwy.get(instructorId) || `Instruktor ${instructorId.slice(0, 8)}`,
    srednia: a.suma / a.liczba,
    liczba: a.liczba,
  }));
}

/** R14b: admin ustawia „dopuszczony do jazd" (obsługa rat). */
export async function setClearedToDrive(enrollmentId: string, cleared: boolean): Promise<void> {
  const { error } = await supabase
    .from("enrollment")
    .update({ cleared_to_drive: cleared })
    .eq("id", enrollmentId);
  if (error) throw error;
  void logujAkcje("zmiana_dopuszczenia_do_jazd", { enrollmentId, cleared });
}

// ---------------------------------------------------------------------------
// Sale wykładowe
// ---------------------------------------------------------------------------

export interface RoomRow {
  id: string;
  nazwa: string;
  adres: string | null;
  pojemnosc: number;
}

export async function listRooms(oskId: string): Promise<RoomRow[]> {
  const { data, error } = await supabase
    .from("room")
    .select("id, nazwa, adres, pojemnosc")
    .eq("osk_id", oskId)
    .order("nazwa");
  if (error) throw error;
  return (data ?? []) as RoomRow[];
}

export async function addRoom(
  oskId: string,
  d: { nazwa: string; adres: string; pojemnosc: number },
): Promise<void> {
  const { error } = await supabase.from("room").insert({ osk_id: oskId, ...d });
  if (error) throw error;
}

export async function deleteRoom(id: string): Promise<void> {
  const { error } = await supabase.from("room").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Flota aut
// ---------------------------------------------------------------------------

export interface VehicleRow {
  id: string;
  nr_rejestracyjny: string;
  marka_model: string | null;
  przeglad_do: string | null;
  ubezpieczenie_do: string | null;
  przebieg_biezacy: number;
  serwis_ostatni_przebieg: number;
  serwis_limit_km: number;
  aktywny: boolean;
}

export interface DaneAuta {
  nr_rejestracyjny: string;
  marka_model: string;
  przeglad_do: string | null;
  ubezpieczenie_do: string | null;
  przebieg_biezacy: number;
  serwis_limit_km: number;
}

export async function listVehicles(oskId: string): Promise<VehicleRow[]> {
  const { data, error } = await supabase
    .from("vehicle")
    .select(
      "id, nr_rejestracyjny, marka_model, przeglad_do, ubezpieczenie_do, przebieg_biezacy, serwis_ostatni_przebieg, serwis_limit_km, aktywny",
    )
    .eq("osk_id", oskId)
    .order("nr_rejestracyjny");
  if (error) throw error;
  return (data ?? []) as VehicleRow[];
}

export async function addVehicle(oskId: string, d: DaneAuta): Promise<void> {
  const { error } = await supabase.from("vehicle").insert({ osk_id: oskId, ...d });
  if (error) throw error;
}

export async function setVehicleActive(id: string, aktywny: boolean): Promise<void> {
  const { error } = await supabase.from("vehicle").update({ aktywny }).eq("id", id);
  if (error) throw error;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicle").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Charakterystyka OSK (nazwa)
// ---------------------------------------------------------------------------

export async function getOskName(oskId: string): Promise<string> {
  const { data, error } = await supabase.from("osk").select("nazwa").eq("id", oskId).single();
  if (error) throw error;
  return (data?.nazwa as string) ?? "";
}

export async function updateOskName(oskId: string, nazwa: string): Promise<void> {
  const { error } = await supabase.from("osk").update({ nazwa }).eq("id", oskId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Zasoby OSK dla silnika weryfikacji pojemności kursu (src/engine/capacity.ts)
// ---------------------------------------------------------------------------

function godzinyMiedzy(od: string, doG: string): number {
  const [oh = 0, om = 0] = od.split(":").map(Number);
  const [dh = 0, dm = 0] = doG.split(":").map(Number);
  return (dh * 60 + dm - (oh * 60 + om)) / 60;
}

// ---------------------------------------------------------------------------
// Zgłoszenia instruktorów do admina (urlop/problem/zmiana grafiku)
// ---------------------------------------------------------------------------

export interface InstructorRequestRow {
  id: string;
  instructor_id: string;
  typ: string;
  tresc: string;
  status: "pending" | "rozpatrzone";
  created_at: string;
}

export async function listInstructorRequests(oskId: string): Promise<InstructorRequestRow[]> {
  const { data, error } = await supabase
    .from("instructor_request")
    .select("id, instructor_id, typ, tresc, status, created_at")
    .eq("osk_id", oskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstructorRequestRow[];
}

export async function resolveInstructorRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("instructor_request")
    .update({ status: "rozpatrzone", rozpatrzone_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Pulpit admina — zagregowane statystyki (kafelki)
// ---------------------------------------------------------------------------

export interface DashboardStats {
  liczbaAktywnychKursow: number;
  najblizszyKurs: { nazwa: string; dataPoczatku: string; dniDo: number } | null;
  liczbaOczekujacychZgloszenKursantow: number;
  liczbaOczekujacychZgloszenInstruktorow: number;
  liczbaOczekujacychZgloszenGieldy: number;
  najblizszeTerminyFloty: { opis: string; data: string; dniDo: number }[];
  liczbaKursantowWTymRoku: number;
  liczbaInstruktorow: number;
  liczbaAktywnychAut: number;
  zdawalnoscSymulacji: { procent: number; liczbaPodejsc: number } | null;
}

function dniDo(data: string, dzis: Date): number {
  return Math.ceil((new Date(data).getTime() - dzis.getTime()) / 86_400_000);
}

export async function fetchDashboardStats(oskId: string): Promise<DashboardStats> {
  const dzis = new Date();
  const poczatekRoku = `${dzis.getFullYear()}-01-01`;
  const [
    { data: kursy },
    { count: zgloszeniaKursanci },
    { count: zgloszeniaInstr },
    auta,
    { count: zgloszeniaGieldy },
    { count: kursanciRok },
    { count: liczbaInstruktorow },
    { data: symulacje },
  ] = await Promise.all([
    supabase.from("course").select("nazwa, data_poczatku, zapisy_otwarte").eq("osk_id", oskId),
    supabase
      .from("candidate_application")
      .select("id", { count: "exact", head: true })
      .eq("osk_id", oskId)
      .eq("status", "pending"),
    supabase
      .from("instructor_request")
      .select("id", { count: "exact", head: true })
      .eq("osk_id", oskId)
      .eq("status", "pending"),
    listVehicles(oskId),
    supabase
      .from("gielda_zgloszenie")
      .select("id", { count: "exact", head: true })
      .eq("osk_id", oskId)
      .eq("status", "oczekuje"),
    supabase
      .from("enrollment")
      .select("id", { count: "exact", head: true })
      .eq("osk_id", oskId)
      .gte("created_at", poczatekRoku),
    supabase.from("instructor").select("id", { count: "exact", head: true }).eq("osk_id", oskId),
    supabase.from("test_attempt").select("zaliczony").eq("osk_id", oskId).eq("tryb", "symulacja"),
  ]);

  const wszystkieKursy = (kursy ?? []) as {
    nazwa: string;
    data_poczatku: string | null;
    zapisy_otwarte: boolean;
  }[];
  const aktywne = wszystkieKursy.filter((k) => k.zapisy_otwarte);
  const przyszle = wszystkieKursy
    .filter((k) => k.data_poczatku && new Date(k.data_poczatku) >= dzis)
    .sort((a, b) => new Date(a.data_poczatku!).getTime() - new Date(b.data_poczatku!).getTime());
  const najblizszy = przyszle[0];

  const terminyFloty: { opis: string; data: string; dniDo: number }[] = [];
  for (const v of auta) {
    if (v.przeglad_do) {
      terminyFloty.push({
        opis: `Przegląd — ${v.nr_rejestracyjny}`,
        data: v.przeglad_do,
        dniDo: dniDo(v.przeglad_do, dzis),
      });
    }
    if (v.ubezpieczenie_do) {
      terminyFloty.push({
        opis: `Ubezpieczenie — ${v.nr_rejestracyjny}`,
        data: v.ubezpieczenie_do,
        dniDo: dniDo(v.ubezpieczenie_do, dzis),
      });
    }
  }
  terminyFloty.sort((a, b) => a.dniDo - b.dniDo);

  const liczbaPodejsc = (symulacje ?? []).length;
  const zdawalnoscSymulacji =
    liczbaPodejsc > 0
      ? {
          liczbaPodejsc,
          procent: Math.round(
            ((symulacje ?? []).filter((s) => s.zaliczony).length / liczbaPodejsc) * 100,
          ),
        }
      : null;

  return {
    liczbaAktywnychKursow: aktywne.length,
    najblizszyKurs: najblizszy
      ? {
          nazwa: najblizszy.nazwa,
          dataPoczatku: najblizszy.data_poczatku!,
          dniDo: dniDo(najblizszy.data_poczatku!, dzis),
        }
      : null,
    liczbaOczekujacychZgloszenKursantow: zgloszeniaKursanci ?? 0,
    liczbaOczekujacychZgloszenInstruktorow: zgloszeniaInstr ?? 0,
    liczbaOczekujacychZgloszenGieldy: zgloszeniaGieldy ?? 0,
    najblizszeTerminyFloty: terminyFloty.slice(0, 5),
    liczbaKursantowWTymRoku: kursanciRok ?? 0,
    liczbaInstruktorow: liczbaInstruktorow ?? 0,
    liczbaAktywnychAut: auta.filter((v) => v.aktywny).length,
    zdawalnoscSymulacji,
  };
}

export async function fetchZasobyOsk(oskId: string): Promise<ZasobyOsk> {
  const [sale, vehicles, instruktorzy, { data: godziny, error: eGodz }] = await Promise.all([
    listRooms(oskId),
    listVehicles(oskId),
    listInstructors(oskId),
    supabase.from("working_hours").select("instructor_id, od_godz, do_godz").eq("osk_id", oskId),
  ]);
  if (eGodz) throw eGodz;

  const idyPraktyki = new Set(
    instruktorzy.filter((i) => i.typ !== "wykladowca").map((i) => i.id),
  );
  const idyWykladowcow = new Set(
    instruktorzy.filter((i) => i.typ !== "instruktor_praktyki").map((i) => i.id),
  );

  let godzinyPraktyki = 0;
  let godzinyWykladu = 0;
  for (const g of godziny ?? []) {
    const h = godzinyMiedzy(g.od_godz as string, g.do_godz as string);
    if (idyPraktyki.has(g.instructor_id as string)) godzinyPraktyki += h;
    if (idyWykladowcow.has(g.instructor_id as string)) godzinyWykladu += h;
  }

  return {
    sale: sale.map((s) => ({ pojemnosc: s.pojemnosc })),
    liczbaAktywnychAut: vehicles.filter((v) => v.aktywny).length,
    liczbaInstruktorowPraktyki: idyPraktyki.size,
    godzinyInstruktorowPraktykiTygodniowo: godzinyPraktyki,
    godzinyWykladowcowTygodniowo: godzinyWykladu,
  };
}

// ---------------------------------------------------------------------------
// Giełda wolnych terminów — kolejka kandydatów, admin wybiera
// ---------------------------------------------------------------------------

export interface KandydatGieldy {
  zgloszenieId: string;
  enrollmentId: string;
  createdAt: string;
  godzinyOdbyte: number;
  liczbaOdwolan: number;
  liczbaNieusprawiedliwionych: number;
}

export interface SlotGieldy {
  slotId: string;
  startTs: string;
  endTs: string;
  kandydaci: KandydatGieldy[];
}

export async function listGieldaQueue(courseId: string): Promise<SlotGieldy[]> {
  const { data: zgloszenia, error } = await supabase
    .from("gielda_zgloszenie")
    .select("id, slot_id, enrollment_id, created_at, slot (start_ts, end_ts, course_id)")
    .eq("status", "oczekuje")
    .order("created_at");
  if (error) throw error;

  const naszeKursu = (zgloszenia ?? []).filter(
    (z) => (z.slot as unknown as { course_id: string } | null)?.course_id === courseId,
  );
  if (naszeKursu.length === 0) return [];

  const enrollmentIds = [...new Set(naszeKursu.map((z) => z.enrollment_id as string))];
  const { data: sloty } = await supabase
    .from("slot")
    .select("enrollment_id, status")
    .in("enrollment_id", enrollmentIds);

  function statystyki(enrollmentId: string): Omit<KandydatGieldy, "zgloszenieId" | "enrollmentId" | "createdAt"> {
    const moje = (sloty ?? []).filter((s) => s.enrollment_id === enrollmentId);
    return {
      godzinyOdbyte: moje.filter((s) => s.status === "odbyty").length,
      liczbaOdwolan: moje.filter((s) => s.status === "odwolany_w_oknie" || s.status === "nieusprawiedliwiony")
        .length,
      liczbaNieusprawiedliwionych: moje.filter((s) => s.status === "nieusprawiedliwiony").length,
    };
  }

  const perSlot = new Map<string, SlotGieldy>();
  for (const z of naszeKursu) {
    const slot = z.slot as unknown as { start_ts: string; end_ts: string } | null;
    if (!slot) continue;
    const kandydat: KandydatGieldy = {
      zgloszenieId: z.id as string,
      enrollmentId: z.enrollment_id as string,
      createdAt: z.created_at as string,
      ...statystyki(z.enrollment_id as string),
    };
    const wpis = perSlot.get(z.slot_id as string) ?? {
      slotId: z.slot_id as string,
      startTs: slot.start_ts,
      endTs: slot.end_ts,
      kandydaci: [],
    };
    wpis.kandydaci.push(kandydat);
    perSlot.set(z.slot_id as string, wpis);
  }
  return [...perSlot.values()].sort((a, b) => a.startTs.localeCompare(b.startTs));
}

export async function resolveGieldaZgloszenie(
  zgloszenieId: string,
  decyzja: "zatwierdz" | "odrzuc",
): Promise<void> {
  const { error } = await supabase.functions.invoke("resolve-gielda-zgloszenie", {
    body: { zgloszenieId, decyzja },
  });
  if (error) throw error;
  void logujAkcje("rozstrzygniecie_gieldy", { zgloszenieId, decyzja });
}

// ---------------------------------------------------------------------------
// Log błędów (zamiast Sentry — zero nowej zależności/konta zewnętrznego)
// ---------------------------------------------------------------------------

export interface ErrorLogRow {
  id: string;
  kontekst: string;
  wiadomosc: string;
  created_at: string;
}

export async function listErrorLog(oskId: string): Promise<ErrorLogRow[]> {
  const { data, error } = await supabase
    .from("error_log")
    .select("id, kontekst, wiadomosc, created_at")
    .eq("osk_id", oskId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ErrorLogRow[];
}

// ---------------------------------------------------------------------------
// Układ widgetów w DB — cross-device (osobna tabela, patrz migracja 0014 czemu
// nie kolumna na membership: self-update tam mógłby nadpisać `rola`).
// ---------------------------------------------------------------------------

export async function getMyWidgetLayout(oskId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("widget_layout")
    .select("uklad")
    .eq("osk_id", oskId)
    .maybeSingle();
  if (error) throw error;
  return (data?.uklad as string[] | undefined) ?? null;
}

export async function setMyWidgetLayout(oskId: string, uklad: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("widget_layout")
    .upsert({ osk_id: oskId, user_id: user.id, uklad, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Audit log — podgląd dla admina (kto/kiedy zatwierdził/usunął).
// ---------------------------------------------------------------------------

export interface AuditLogRow {
  id: string;
  akcja: string;
  szczegoly: Record<string, unknown> | null;
  created_at: string;
}

export async function listAuditLog(oskId: string): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, akcja, szczegoly, created_at")
    .eq("osk_id", oskId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}

// ---------------------------------------------------------------------------
// Ręczna korekta grafiku praktyki — admin widzi i poprawia wszystkie sloty kursu.
// ---------------------------------------------------------------------------

export interface SlotAdminRow {
  id: string;
  enrollment_id: string;
  instructor_id: string;
  start_ts: string;
  end_ts: string;
  status: string;
}

export const SLOT_STATUSY = [
  "zaplanowany",
  "odbyty",
  "odwolany_w_oknie",
  "usprawiedliwiony",
  "nieusprawiedliwiony",
  "propozycja",
  "wolny_gielda",
] as const;

export async function listCourseSlots(courseId: string): Promise<SlotAdminRow[]> {
  const { data, error } = await supabase
    .from("slot")
    .select("id, enrollment_id, instructor_id, start_ts, end_ts, status")
    .eq("course_id", courseId)
    .order("start_ts");
  if (error) throw error;
  return (data ?? []) as SlotAdminRow[];
}

export interface CourseInstructorRow {
  instructor_id: string;
  imie: string | null;
  nazwisko: string | null;
}

export async function listCourseInstructors(courseId: string): Promise<CourseInstructorRow[]> {
  const { data, error } = await supabase
    .from("course_instructor")
    .select("instructor_id, instructor (imie, nazwisko)")
    .eq("course_id", courseId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    instructor_id: r.instructor_id as string,
    ...(r.instructor as unknown as { imie: string | null; nazwisko: string | null }),
  }));
}

export async function updateSlotAdmin(
  slotId: string,
  zmiany: Partial<Pick<SlotAdminRow, "instructor_id" | "start_ts" | "end_ts" | "status">>,
): Promise<void> {
  const { error } = await supabase.from("slot").update(zmiany).eq("id", slotId);
  if (error) throw error;
  void logujAkcje("edycja_slotu", { slotId, zmiany });
}

export async function deleteSlotAdmin(slotId: string): Promise<void> {
  const { error } = await supabase.from("slot").delete().eq("id", slotId);
  if (error) throw error;
  void logujAkcje("usuniecie_slotu", { slotId });
}
