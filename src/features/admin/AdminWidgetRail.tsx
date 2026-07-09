import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchDashboardStats, getMyWidgetLayout, setMyWidgetLayout, type DashboardStats } from "./api";

function Kafelek({
  tytul,
  wartosc,
  opis,
  to,
  alarm,
}: {
  tytul: string;
  wartosc: React.ReactNode;
  opis?: React.ReactNode;
  to?: string;
  alarm?: boolean;
}) {
  const tresc = (
    <Card className={cn(to && "transition-colors hover:bg-[var(--muted)]", alarm && "border-[var(--destructive)]")}>
      <CardHeader>
        <CardDescription>{tytul}</CardDescription>
        <CardTitle className={cn("text-2xl", alarm && "text-[var(--destructive)]")}>{wartosc}</CardTitle>
      </CardHeader>
      {opis && <CardContent className="text-sm text-[var(--muted-foreground)]">{opis}</CardContent>}
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {tresc}
    </Link>
  ) : (
    tresc
  );
}

function WidgetTerminyFloty({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Terminy floty</CardDescription>
        <CardTitle className="text-sm font-medium">Przeglądy i ubezpieczenia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {stats.najblizszeTerminyFloty.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">Brak terminów.</p>
        )}
        {stats.najblizszeTerminyFloty.slice(0, 4).map((t) => (
          <div key={`${t.opis}-${t.data}`} className="flex items-center justify-between text-xs">
            <span className="truncate">{t.opis}</span>
            <span className={cn("shrink-0", t.dniDo <= 14 && "font-medium text-[var(--destructive)]")}>
              {t.dniDo} dni
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Katalog widgetów — tylko realne dane z jednego wspólnego pobrania
// (fetchDashboardStats); zdawalność dotyczy symulacji, nie mamy w bazie
// wyników prawdziwego egzaminu WORD.
const KATALOG: Record<string, { etykieta: string; render: (s: DashboardStats) => React.ReactNode }> = {
  aktywne_kursy: {
    etykieta: "Aktywne kursy",
    render: (s) => (
      <Kafelek tytul="Aktywne kursy" wartosc={s.liczbaAktywnychKursow} opis="Z otwartymi zapisami" to="/panel/kursy" />
    ),
  },
  dni_do_kursu: {
    etykieta: "Do najbliższego kursu",
    render: (s) => (
      <Kafelek
        tytul="Do najbliższego kursu"
        wartosc={s.najblizszyKurs ? `${s.najblizszyKurs.dniDo} dni` : "—"}
        opis={s.najblizszyKurs?.nazwa ?? "Brak zaplanowanego startu"}
        to="/panel/kursy"
      />
    ),
  },
  zgloszenia_kursantow: {
    etykieta: "Zgłoszenia kursantów",
    render: (s) => (
      <Kafelek
        tytul="Zgłoszenia kursantów"
        wartosc={s.liczbaOczekujacychZgloszenKursantow}
        opis="Oczekują na zatwierdzenie"
        to="/panel/kursanci"
        alarm={s.liczbaOczekujacychZgloszenKursantow > 0}
      />
    ),
  },
  zgloszenia_instruktorow: {
    etykieta: "Zgłoszenia instruktorów",
    render: (s) => (
      <Kafelek
        tytul="Zgłoszenia instruktorów"
        wartosc={s.liczbaOczekujacychZgloszenInstruktorow}
        opis="Urlopy, problemy, zmiany grafiku"
        to="/panel/instruktorzy"
        alarm={s.liczbaOczekujacychZgloszenInstruktorow > 0}
      />
    ),
  },
  gielda_kolejka: {
    etykieta: "Kolejka giełdy",
    render: (s) => (
      <Kafelek
        tytul="Kolejka giełdy"
        wartosc={s.liczbaOczekujacychZgloszenGieldy}
        opis="Zgłoszenia do zatwierdzenia"
        to="/panel/kursy"
        alarm={s.liczbaOczekujacychZgloszenGieldy > 0}
      />
    ),
  },
  terminy_floty: { etykieta: "Terminy floty", render: (s) => <WidgetTerminyFloty stats={s} /> },
  kursanci_rok: {
    etykieta: "Kursanci w tym roku",
    render: (s) => <Kafelek tytul="Kursanci w tym roku" wartosc={s.liczbaKursantowWTymRoku} to="/panel/kursanci" />,
  },
  zdawalnosc_symulacji: {
    etykieta: "Zdawalność symulacji",
    render: (s) => (
      <Kafelek
        tytul="Zdawalność symulacji"
        wartosc={s.zdawalnoscSymulacji ? `${s.zdawalnoscSymulacji.procent}%` : "—"}
        opis={s.zdawalnoscSymulacji ? `${s.zdawalnoscSymulacji.liczbaPodejsc} podejść` : "Brak podejść"}
      />
    ),
  },
  liczba_instruktorow: {
    etykieta: "Instruktorzy",
    render: (s) => <Kafelek tytul="Instruktorzy" wartosc={s.liczbaInstruktorow} to="/panel/instruktorzy" />,
  },
  liczba_aut: {
    etykieta: "Aktywne auta",
    render: (s) => <Kafelek tytul="Aktywne auta" wartosc={s.liczbaAktywnychAut} to="/panel/ustawienia" />,
  },
};

const LICZBA_SLOTOW = 8;
const DOMYSLNY_UKLAD = [
  "aktywne_kursy",
  "dni_do_kursu",
  "zgloszenia_kursantow",
  "zgloszenia_instruktorow",
  "gielda_kolejka",
  "kursanci_rok",
  "zdawalnosc_symulacji",
  "terminy_floty",
];
const KLUCZ_UKLAD = "osknapp_widget_layout";
const KLUCZ_WIDOCZNOSC = "osknapp_widgets_on";

function wczytajUklad(): string[] {
  try {
    const zapisany = JSON.parse(localStorage.getItem(KLUCZ_UKLAD) ?? "null") as string[] | null;
    if (zapisany?.length === LICZBA_SLOTOW && zapisany.every((id) => id in KATALOG)) return zapisany;
  } catch {
    // ponytail: nieprawidłowy JSON w localStorage = wracamy do domyślnego układu
  }
  return DOMYSLNY_UKLAD;
}

export interface WidgetLayout {
  stats: DashboardStats | null;
  blad: string | null;
  uklad: string[];
  widgetsOn: boolean;
  setWidgetsOn: (on: boolean) => void;
  zamienWidget: (index: number, id: string) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  katalog: typeof KATALOG;
}

/** Współdzielony stan pulpitu bocznego — jedno pobranie, jeden układ dla obu kolumn. */
export function useWidgetLayout(oskId: string | null): WidgetLayout {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [blad, setBlad] = React.useState<string | null>(null);
  const [uklad, setUklad] = React.useState<string[]>(wczytajUklad);
  const [widgetsOn, setWidgetsOnState] = React.useState(
    () => localStorage.getItem(KLUCZ_WIDOCZNOSC) !== "off",
  );
  const przeciagany = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!oskId) return;
    fetchDashboardStats(oskId)
      .then(setStats)
      .catch((e) => setBlad((e as Error).message));
    // cross-device: układ z bazy nadpisuje localStorage, jeśli istnieje
    getMyWidgetLayout(oskId)
      .then((z) => {
        if (z?.length === LICZBA_SLOTOW && z.every((id) => id in KATALOG)) setUklad(z);
      })
      .catch(() => {});
  }, [oskId]);

  function zapiszUklad(nowy: string[]) {
    setUklad(nowy);
    localStorage.setItem(KLUCZ_UKLAD, JSON.stringify(nowy));
    if (oskId) void setMyWidgetLayout(oskId, nowy).catch(() => {});
  }

  function setWidgetsOn(on: boolean) {
    setWidgetsOnState(on);
    localStorage.setItem(KLUCZ_WIDOCZNOSC, on ? "on" : "off");
  }

  function zamienWidget(index: number, id: string) {
    const nowy = [...uklad];
    nowy[index] = id;
    zapiszUklad(nowy);
  }

  function onDrop(index: number) {
    const zrodlo = przeciagany.current;
    if (zrodlo === null || zrodlo === index) return;
    const nowy = [...uklad];
    const tmp = nowy[zrodlo]!;
    nowy[zrodlo] = nowy[index]!;
    nowy[index] = tmp;
    zapiszUklad(nowy);
    przeciagany.current = null;
  }

  return {
    stats,
    blad,
    uklad,
    widgetsOn,
    setWidgetsOn,
    zamienWidget,
    onDragStart: (index) => (przeciagany.current = index),
    onDrop,
    katalog: KATALOG,
  };
}

/** Pionowa kolumna widgetów (lewa lub prawa) — używa wspólnego layoutu z useWidgetLayout. */
export function WidgetColumn({ layout, indices }: { layout: WidgetLayout; indices: number[] }) {
  if (!layout.widgetsOn) return null;
  if (layout.blad) return <p className="w-64 text-sm text-[var(--destructive)]">{layout.blad}</p>;
  if (!layout.stats) return null;

  return (
    <div className="hidden w-64 shrink-0 space-y-4 p-4 lg:block">
      {indices.map((index) => {
        const id = layout.uklad[index];
        if (!id) return null;
        return (
          <div
            key={index}
            draggable
            onDragStart={() => layout.onDragStart(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => layout.onDrop(index)}
            className="relative cursor-move"
          >
            <select
              aria-label="Wybierz widget"
              value={id}
              onChange={(e) => layout.zamienWidget(index, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-2 z-10 rounded border border-[var(--border)] bg-[var(--surface)] text-xs"
            >
              {Object.entries(layout.katalog).map(([katalogId, w]) => (
                <option key={katalogId} value={katalogId}>
                  {w.etykieta}
                </option>
              ))}
            </select>
            {layout.katalog[id]?.render(layout.stats!)}
          </div>
        );
      })}
    </div>
  );
}

export function WidgetToggle({ layout }: { layout: WidgetLayout }) {
  return (
    <Button size="sm" variant="ghost" onClick={() => layout.setWidgetsOn(!layout.widgetsOn)}>
      {layout.widgetsOn ? "Ukryj widgety" : "Pokaż widgety"}
    </Button>
  );
}
