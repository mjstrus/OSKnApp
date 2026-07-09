import { czyDopuszczonyDoEgzaminu, ileDokupic } from "@/engine/hours";
import type { StanKursanta } from "@/engine/types";

// Pasek postępu godzin praktyki „X / cel h" (R14b, R13). Stan liczony przez silnik.
export function HoursProgress({ stan }: { stan: StanKursanta }) {
  const procent = stan.cel > 0 ? Math.min(100, Math.round((stan.potwierdzone / stan.cel) * 100)) : 0;
  const dopuszczony = czyDopuszczonyDoEgzaminu(stan);
  const dokup = ileDokupic(stan);

  return (
    <div className="space-y-2" role="group" aria-label="Postęp godzin praktyki">
      <div className="flex justify-between text-sm">
        <span>Godziny praktyki</span>
        <span data-testid="licznik">
          {stan.potwierdzone} / {stan.cel} h
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full bg-[var(--primary)] transition-all"
          style={{ width: `${procent}%` }}
          data-testid="pasek"
        />
      </div>
      {dopuszczony ? (
        <p className="text-sm font-medium text-green-600">Dopuszczony do egzaminu wewnętrznego</p>
      ) : dokup > 0 ? (
        <p className="text-sm text-[var(--destructive)]">
          Wymagany dokup: {dokup} h (pula opłaconych nie starcza do celu)
        </p>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Do dopuszczenia brakuje {stan.cel - stan.potwierdzone} h
        </p>
      )}
    </div>
  );
}
