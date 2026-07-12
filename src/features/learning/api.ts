import { supabase } from "@/lib/supabase";
import { dobierzPytania, type Pytanie, type WynikPodejscia } from "@/engine/exam";

export type PytanieDB = Pytanie & {
  tresc: string;
  opcje?: unknown;
  media_url?: string | null;
  wyjasnienie?: string | null;
};

/** Bank pytań danej kategorii (globalny, R16). */
export async function fetchQuestionBank(kategoria: string): Promise<PytanieDB[]> {
  const { data, error } = await supabase
    .from("question")
    .select("id, kategoria, typ, waga, poprawna, tresc, opcje, media_url, wyjasnienie")
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

interface ZapiszPodejscieParams {
  oskId: string;
  enrollmentId: string;
  tryb: "symulacja" | "nauka";
  pytania: Pytanie[];
  odpowiedzi: Record<string, string>;
  punkty: number;
  maxPkt: number;
  zaliczony: boolean | null;
}

async function zapiszPodejscie(p: ZapiszPodejscieParams): Promise<void> {
  const { data: attempt, error } = await supabase
    .from("test_attempt")
    .insert({
      osk_id: p.oskId,
      enrollment_id: p.enrollmentId,
      tryb: p.tryb,
      punkty: p.punkty,
      max_pkt: p.maxPkt,
      zaliczony: p.zaliczony,
      zakonczono_ts: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !attempt) throw error ?? new Error("Nie zapisano podejścia");

  const answers = p.pytania.map((q) => ({
    osk_id: p.oskId,
    attempt_id: attempt.id,
    question_id: q.id,
    wybrana_odp: p.odpowiedzi[q.id] ?? null,
    poprawna: p.odpowiedzi[q.id] === q.poprawna,
  }));
  const { error: aErr } = await supabase.from("answer").insert(answers);
  if (aErr) throw aErr;
}

/** Zapis podejścia symulacji + odpowiedzi (R16). */
export async function saveSimulation(params: {
  oskId: string;
  enrollmentId: string;
  pytania: Pytanie[];
  odpowiedzi: Record<string, string>;
  wynik: WynikPodejscia;
}): Promise<void> {
  await zapiszPodejscie({
    ...params,
    tryb: "symulacja",
    punkty: params.wynik.punkty,
    maxPkt: params.wynik.maxPkt,
    zaliczony: params.wynik.zaliczony,
  });
}

/** Zapis podejścia trybu nauki — bez limitu czasu, bez progu zaliczenia (nie ma sensu na całym banku). */
export async function savePractice(params: {
  oskId: string;
  enrollmentId: string;
  pytania: Pytanie[];
  odpowiedzi: Record<string, string>;
}): Promise<void> {
  let punkty = 0;
  let maxPkt = 0;
  for (const q of params.pytania) {
    maxPkt += q.waga;
    if (params.odpowiedzi[q.id] === q.poprawna) punkty += q.waga;
  }
  await zapiszPodejscie({ ...params, tryb: "nauka", punkty, maxPkt, zaliczony: null });
}
