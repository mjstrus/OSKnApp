import { supabase } from "./supabase";

/** Zapisuje błąd do error_log (fire-and-forget) — zamiast Sentry: zero nowej zależności/konta. */
export function logError(kontekst: string, err: unknown): void {
  const wiadomosc = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  void supabase
    .from("error_log")
    .insert({ kontekst, wiadomosc, stack })
    .then(() => {});
}

/** Łapie nieobsłużone błędy JS i odrzucone Promise — wołać raz przy starcie appki. */
export function podepnijGlobalnyLogBledow(): void {
  window.addEventListener("error", (e) => logError("window.onerror", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => logError("unhandledrejection", e.reason));
}
