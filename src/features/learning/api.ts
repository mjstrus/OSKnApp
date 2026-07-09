import { supabase } from "@/lib/supabase";
import { dobierzPytania, type Pytanie, type WynikPodejscia } from "@/engine/exam";

export type PytanieDB = Pytanie & { tresc: string; opcje?: unknown };

/** Bank pytań danej kategorii (globalny, R16). */
export async function fetchQuestionBank(kategoria: string): Promise<PytanieDB[]> {
  const { data, error } = await supabase
    .from("question")
    .select("id, kategoria, typ, waga, poprawna, tresc, opcje")
    .eq("kategoria", kategoria)
    .eq("aktywne", true);
  if (error) throw error;
  return (data ?? []) as PytanieDB[];
}

/** Dobiera zestaw symulacji z banku przez silnik (rzuca, gdy za mało pytań). */
export async function buildSimulation(kategoria: string): Promise<PytanieDB[]> {
  const bank = await fetchQuestionBank(kategoria);
  return dobierzPytania(bank, kategoria) as PytanieDB[];
}

/** Zapis podejścia symulacji + odpowiedzi (R16). */
export async function saveSimulation(params: {
  oskId: string;
  enrollmentId: string;
  pytania: Pytanie[];
  odpowiedzi: Record<string, string>;
  wynik: WynikPodejscia;
}): Promise<void> {
  const { data: attempt, error } = await supabase
    .from("test_attempt")
    .insert({
      osk_id: params.oskId,
      enrollment_id: params.enrollmentId,
      tryb: "symulacja",
      punkty: params.wynik.punkty,
      max_pkt: params.wynik.maxPkt,
      zaliczony: params.wynik.zaliczony,
      zakonczono_ts: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !attempt) throw error ?? new Error("Nie zapisano podejścia");

  const answers = params.pytania.map((q) => ({
    osk_id: params.oskId,
    attempt_id: attempt.id,
    question_id: q.id,
    wybrana_odp: params.odpowiedzi[q.id] ?? null,
    poprawna: params.odpowiedzi[q.id] === q.poprawna,
  }));
  const { error: aErr } = await supabase.from("answer").insert(answers);
  if (aErr) throw aErr;
}
