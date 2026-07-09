import type { DaneZgloszenia } from "@/engine/onboarding";

export interface OknoDostepnosci {
  start_ts: string;
  end_ts: string;
}

/**
 * Rozwija wybór "te dni tygodnia w tych godzinach" na konkretne okna czasowe
 * (najbliższe N tygodni od dziś) — wejście dla candidate_application.dostepnosc
 * / availability. 8 tygodni w przód wystarcza na dopasowanie pierwszych jazd.
 */
export function rozwinDostepnosc(
  dni: number[],
  odGodz: string,
  doGodz: string,
  tygodni = 8,
): OknoDostepnosci[] {
  const [oh = 0, om = 0] = odGodz.split(":").map(Number);
  const [dh = 0, dm = 0] = doGodz.split(":").map(Number);
  const dzis = new Date();
  const poniedzialek = new Date(dzis);
  poniedzialek.setDate(dzis.getDate() + ((1 - dzis.getDay() + 7) % 7)); // dziś lub najbliższy pon.

  const okna: OknoDostepnosci[] = [];
  for (let tydzien = 0; tydzien < tygodni; tydzien++) {
    for (const dzien of dni) {
      const data = new Date(poniedzialek);
      data.setDate(poniedzialek.getDate() + tydzien * 7 + dzien);
      const start = new Date(data);
      start.setHours(oh, om, 0, 0);
      const end = new Date(data);
      end.setHours(dh, dm, 0, 0);
      if (start >= dzis) okna.push({ start_ts: start.toISOString(), end_ts: end.toISOString() });
    }
  }
  return okna;
}

export interface SubmitPayload extends DaneZgloszenia {
  courseId: string;
  dostepnosc?: OknoDostepnosci[];
}

export interface WynikSubmit {
  applicationId: string;
  status: string;
}

/** Wysyła zgłoszenie do Edge Function submit-application (publiczna, R4). */
export async function submitApplication(payload: SubmitPayload): Promise<WynikSubmit> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${url}/functions/v1/submit-application`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify(payload),
  });

  const dane = (await res.json().catch(() => ({}))) as {
    applicationId?: string;
    status?: string;
    error?: string;
    braki?: string[];
  };
  if (!res.ok) {
    const detale = dane.braki?.length ? `: ${dane.braki.join(", ")}` : "";
    throw new Error((dane.error ?? "Błąd wysyłki zgłoszenia") + detale);
  }
  return { applicationId: dane.applicationId!, status: dane.status ?? "pending" };
}
