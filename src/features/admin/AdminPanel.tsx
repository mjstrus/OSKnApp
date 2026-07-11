import * as React from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { CalendarDays, Car, GraduationCap, HelpCircle, Settings, UserCog, Users } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell, type NavItem } from "@/app/AppShell";
import { InstructorScoring, type ScoringInstruktora } from "./InstructorScoring";
import { InstructorsSection } from "./InstructorsSection";
import { InstructorDetail } from "./InstructorDetail";
import { CoursesSection } from "./CoursesSection";
import { CourseDetail } from "./CourseDetail";
import { CalendarOverview } from "./CalendarOverview";
import { ApplicationsAndEnrollments } from "./ApplicationsAndEnrollments";
import { SettingsSection } from "./SettingsSection";
import { FleetSection } from "./FleetSection";
import { HelpSection } from "./HelpSection";
import { useWidgetLayout, WidgetColumn, WidgetToggle } from "./AdminWidgetRail";
import {
  addCourse,
  approveApplication,
  fetchInstructorScores,
  listApplications,
  listCourses,
  type KursRow,
  type ZgloszenieRow,
} from "./api";

const NAV: NavItem[] = [
  { to: "/panel/kalendarz", label: "Kalendarz", icon: CalendarDays },
  {
    to: "/panel/kursy",
    label: "Kursy",
    icon: GraduationCap,
    submenu: [
      { to: "/panel/kursy#nowy-kurs", label: "Dodaj/zaplanuj nowy kurs" },
      { to: "/panel/kursy#szukaj-kursu", label: "Wyszukaj kurs" },
    ],
  },
  {
    to: "/panel/instruktorzy",
    label: "Instruktorzy",
    icon: UserCog,
    submenu: [
      { to: "/panel/instruktorzy#nowy-instruktor", label: "Dodaj nowego instruktora/wykładowcę" },
      { to: "/panel/instruktorzy", label: "Lista instruktorów" },
    ],
  },
  { to: "/panel/kursanci", label: "Kursanci", icon: Users },
  { to: "/panel/flota", label: "Flota", icon: Car },
];

const headerIconClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md p-2 transition-colors ${isActive ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]"}`;

function BrakDostepu() {
  return <p className="text-sm text-[var(--muted-foreground)]">Brak dostępu do tej sekcji.</p>;
}

export function AdminPanel() {
  const { oskId, rola, uprawnienia } = useAuth();
  // Pełny admin widzi wszystko; 'biuro' tylko zakładki z uprawnienia (UI-only, patrz migracja 0018).
  const widac = React.useCallback(
    (sekcja: string) => rola !== "biuro" || uprawnienia.includes(sekcja),
    [rola, uprawnienia],
  );
  const navItems = React.useMemo(() => NAV.filter((n) => widac(n.to.split("/")[2]!)), [widac]);
  const [kursy, setKursy] = React.useState<KursRow[]>([]);
  const [zgloszenia, setZgloszenia] = React.useState<ZgloszenieRow[]>([]);
  const [scoring, setScoring] = React.useState<ScoringInstruktora[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);
  const widgetLayout = useWidgetLayout(oskId);

  const odswiez = React.useCallback(async () => {
    if (!oskId) return;
    try {
      setKursy(await listCourses(oskId));
      setZgloszenia(await listApplications(oskId));
      setScoring(await fetchInstructorScores(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function dodajKurs(d: Parameters<typeof addCourse>[1]) {
    if (!oskId) return;
    await addCourse(oskId, d);
    await odswiez();
  }

  async function zatwierdz(id: string) {
    setBlad(null);
    try {
      await approveApplication(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  const domyslna = navItems[0]?.to.split("/")[2] ?? "pomoc";

  return (
    <AppShell
      navItems={navItems}
      headerExtra={
        <>
          {widac("ustawienia") && (
            <NavLink to="/panel/ustawienia" className={headerIconClass} aria-label="Ustawienia">
              <Settings className="h-4 w-4" />
            </NavLink>
          )}
          <NavLink to="/panel/pomoc" className={headerIconClass} aria-label="Pomoc">
            <HelpCircle className="h-4 w-4" />
          </NavLink>
          {rola !== "biuro" && <WidgetToggle layout={widgetLayout} />}
        </>
      }
      left={rola !== "biuro" ? <WidgetColumn layout={widgetLayout} indices={[0, 1, 2, 3]} /> : null}
      right={rola !== "biuro" ? <WidgetColumn layout={widgetLayout} indices={[4, 5, 6, 7]} /> : null}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

        <Routes>
          <Route index element={<Navigate to={domyslna} replace />} />
          <Route
            path="kalendarz"
            element={!widac("kalendarz") ? <BrakDostepu /> : oskId ? <CalendarOverview oskId={oskId} /> : null}
          />
          <Route
            path="kursy"
            element={
              !widac("kursy") ? (
                <BrakDostepu />
              ) : oskId ? (
                <CoursesSection oskId={oskId} kursy={kursy} onAdd={dodajKurs} />
              ) : null
            }
          />
          <Route path="kursy/:courseId" element={!widac("kursy") ? <BrakDostepu /> : <CourseDetail />} />
          <Route
            path="instruktorzy"
            element={
              !widac("instruktorzy") ? (
                <BrakDostepu />
              ) : oskId ? (
                <div className="space-y-6">
                  <InstructorsSection oskId={oskId} />
                  <InstructorScoring pozycje={scoring} />
                </div>
              ) : null
            }
          />
          <Route
            path="instruktorzy/:instructorId"
            element={!widac("instruktorzy") ? <BrakDostepu /> : oskId ? <InstructorDetail oskId={oskId} /> : null}
          />
          <Route
            path="kursanci"
            element={
              !widac("kursanci") ? (
                <BrakDostepu />
              ) : (
                <ApplicationsAndEnrollments zgloszenia={zgloszenia} kursy={kursy} onApprove={zatwierdz} />
              )
            }
          />
          <Route
            path="flota"
            element={!widac("flota") ? <BrakDostepu /> : oskId ? <FleetSection oskId={oskId} /> : null}
          />
          <Route
            path="ustawienia"
            element={!widac("ustawienia") ? <BrakDostepu /> : oskId ? <SettingsSection oskId={oskId} /> : null}
          />
          <Route path="pomoc" element={<HelpSection />} />
        </Routes>
      </div>
    </AppShell>
  );
}
