import * as React from "react";
import { cn } from "@/lib/utils";

export interface WydarzenieKalendarza {
  data: Date;
  etykieta: string;
  podetykieta?: string;
  kolor?: "domyslny" | "alarm" | "sukces";
}

const DNI_TYG = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
const MIESIACE = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const KOLOR_KLASA: Record<NonNullable<WydarzenieKalendarza["kolor"]>, string> = {
  domyslny: "bg-[var(--primary)] text-[var(--primary-foreground)]",
  alarm: "bg-[var(--destructive)] text-white",
  sukces: "bg-green-600 text-white",
};

function kluczMiesiaca(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function Komorka({ dzien, wydarzenia }: { dzien: number | null; wydarzenia: WydarzenieKalendarza[] }) {
  return (
    <div
      className={cn(
        "min-h-16 rounded border p-1 text-left align-top",
        dzien === null ? "border-transparent" : "border-[var(--border)]",
      )}
    >
      {dzien !== null && (
        <>
          <div className="text-[11px] text-[var(--muted-foreground)]">{dzien}</div>
          {wydarzenia.map((w, idx) => (
            <div
              key={idx}
              className={cn("mt-0.5 rounded px-1 py-0.5 text-[10px] leading-tight", KOLOR_KLASA[w.kolor ?? "domyslny"])}
            >
              {w.etykieta}
              {w.podetykieta && <span className="opacity-80"> · {w.podetykieta}</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Kalendarz miesięczny (siatka 7 kolumn) — grupuje wydarzenia po miesiącach, renderuje po jednym gridzie na miesiąc. */
export function KalendarzMiesieczny({ wydarzenia }: { wydarzenia: WydarzenieKalendarza[] }) {
  if (wydarzenia.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">Brak wydarzeń do pokazania.</p>;
  }

  const posortowane = [...wydarzenia].sort((a, b) => a.data.getTime() - b.data.getTime());
  const miesiace = new Map<
    string,
    { rok: number; miesiac: number; dni: Map<number, WydarzenieKalendarza[]> }
  >();
  for (const w of posortowane) {
    const klucz = kluczMiesiaca(w.data);
    if (!miesiace.has(klucz)) {
      miesiace.set(klucz, { rok: w.data.getFullYear(), miesiac: w.data.getMonth(), dni: new Map() });
    }
    const wpis = miesiace.get(klucz)!;
    const dzien = w.data.getDate();
    if (!wpis.dni.has(dzien)) wpis.dni.set(dzien, []);
    wpis.dni.get(dzien)!.push(w);
  }

  return (
    <div className="space-y-6">
      {[...miesiace.values()].map(({ rok, miesiac, dni }) => {
        const pierwszy = new Date(rok, miesiac, 1);
        const liczbaDni = new Date(rok, miesiac + 1, 0).getDate();
        const offset = (pierwszy.getDay() + 6) % 7; // 0 = poniedziałek
        const komorki: (number | null)[] = [
          ...Array(offset).fill(null),
          ...Array.from({ length: liczbaDni }, (_, i) => i + 1),
        ];

        return (
          <div key={`${rok}-${miesiac}`}>
            <h3 className="mb-2 text-sm font-medium">
              {MIESIACE[miesiac]} {rok}
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {DNI_TYG.map((d) => (
                <div key={d} className="py-1 text-center text-xs font-medium text-[var(--muted-foreground)]">
                  {d}
                </div>
              ))}
              {komorki.map((dzien, i) => (
                <Komorka key={i} dzien={dzien} wydarzenia={dzien === null ? [] : (dni.get(dzien) ?? [])} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function poniedzialekTygodnia(ref: Date): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Kalendarz jednego tygodnia (7 dni od poniedziałku zawierającego `odDnia`). */
function KalendarzTygodniowy({ wydarzenia, odDnia }: { wydarzenia: WydarzenieKalendarza[]; odDnia: Date }) {
  const poniedzialek = poniedzialekTygodnia(odDnia);
  const dni = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(poniedzialek);
    d.setDate(poniedzialek.getDate() + i);
    return d;
  });

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">
        {poniedzialek.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })} –{" "}
        {dni[6]!.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {DNI_TYG.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-[var(--muted-foreground)]">
            {d}
          </div>
        ))}
        {dni.map((d) => (
          <Komorka
            key={d.toISOString()}
            dzien={d.getDate()}
            wydarzenia={wydarzenia.filter((w) => w.data.toDateString() === d.toDateString())}
          />
        ))}
      </div>
    </div>
  );
}

/** Kalendarz z przełącznikiem miesiąc/tydzień (widok centralny pulpitu admina). */
export function KalendarzPrzelaczany({ wydarzenia }: { wydarzenia: WydarzenieKalendarza[] }) {
  const [tryb, setTryb] = React.useState<"miesiac" | "tydzien">("miesiac");
  const dzis = new Date();

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setTryb("miesiac")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            tryb === "miesiac" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--muted)]",
          )}
        >
          Miesiąc
        </button>
        <button
          onClick={() => setTryb("tydzien")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            tryb === "tydzien" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--muted)]",
          )}
        >
          Tydzień
        </button>
      </div>
      {tryb === "miesiac" ? (
        <KalendarzMiesieczny wydarzenia={wydarzenia} />
      ) : (
        <KalendarzTygodniowy wydarzenia={wydarzenia} odDnia={dzis} />
      )}
    </div>
  );
}
