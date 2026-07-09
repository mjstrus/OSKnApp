import * as React from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BookOpen, CalendarDays, HelpCircle, MessageCircle, Repeat, Trophy, User } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell, type NavItem } from "@/app/AppShell";
import { SimulationSection } from "@/features/learning/SimulationSection";
import { TheoryPractice } from "@/features/learning/TheoryPractice";
import { RankingSection } from "@/features/leaderboard/RankingSection";
import { ChatSection } from "@/features/chat/ChatSection";
import { BookingView } from "./BookingView";
import { PracticeSchedule } from "./PracticeSchedule";
import { GieldaSection } from "./GieldaSection";
import { TheorySchedule } from "./TheorySchedule";
import { MyDataSection } from "./MyDataSection";
import { KursantHelpSection } from "./KursantHelpSection";
import { KursantWidgetLeft, KursantWidgetRight } from "./KursantWidgets";
import { bookSlot, cancelSlot, getKursantContext, type KursantContext } from "./api";
import type { SlotDoRezerwacji, SlotView } from "./types";

const NAV: NavItem[] = [
  { to: "/panel/terminarz", label: "Terminarz", icon: CalendarDays },
  { to: "/panel/gielda", label: "Giełda", icon: Repeat },
  {
    to: "/panel/nauka/testy",
    label: "Nauka",
    icon: BookOpen,
    submenu: [
      { to: "/panel/nauka/teoria", label: "Teoria" },
      { to: "/panel/nauka/testy", label: "Testy" },
    ],
  },
  { to: "/panel/ranking", label: "Ranking", icon: Trophy },
  { to: "/panel/chat", label: "Chat", icon: MessageCircle },
];

const headerIconClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md p-2 transition-colors ${isActive ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]"}`;

export function KursantPanel() {
  const { oskId } = useAuth();
  const [ctx, setCtx] = React.useState<KursantContext | null>(null);
  const [ladowanie, setLadowanie] = React.useState(true);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    if (!oskId) return;
    setLadowanie(true);
    try {
      setCtx(await getKursantContext(oskId));
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setLadowanie(false);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function rezerwuj(slot: SlotDoRezerwacji) {
    if (!ctx) return;
    setBlad(null);
    try {
      await bookSlot({
        enrollmentId: ctx.enrollmentId,
        instructorId: slot.instructor_id,
        startTs: slot.start_ts,
        endTs: slot.end_ts,
      });
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function odwolaj(slot: SlotView) {
    setBlad(null);
    try {
      await cancelSlot(slot.id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (ladowanie) return <p className="p-6">Ładowanie…</p>;
  if (!ctx) return <p className="p-6">Brak aktywnego zapisu na kurs.</p>;

  return (
    <AppShell
      navItems={NAV}
      headerExtra={
        <>
          <NavLink to="/panel/dane" className={headerIconClass} aria-label="Moje dane">
            <User className="h-4 w-4" />
          </NavLink>
          <NavLink to="/panel/pomoc" className={headerIconClass} aria-label="Pomoc">
            <HelpCircle className="h-4 w-4" />
          </NavLink>
        </>
      }
      left={<KursantWidgetLeft ctx={ctx} />}
      right={<KursantWidgetRight ctx={ctx} />}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

        <Routes>
          <Route index element={<Navigate to="terminarz" replace />} />
          <Route
            path="terminarz"
            element={
              <div className="space-y-6">
                <TheorySchedule courseId={ctx.courseId} mojeSloty={ctx.mojeSloty} />
                <PracticeSchedule enrollmentId={ctx.enrollmentId} />
                <BookingView
                  clearedToDrive={ctx.clearedToDrive}
                  dostepneSloty={ctx.dostepneSloty}
                  mojeSloty={ctx.mojeSloty}
                  onBook={rezerwuj}
                  onCancel={odwolaj}
                />
              </div>
            }
          />
          <Route
            path="gielda"
            element={<GieldaSection courseId={ctx.courseId} enrollmentId={ctx.enrollmentId} />}
          />
          <Route path="nauka" element={<Navigate to="testy" replace />} />
          <Route path="nauka/teoria" element={<TheoryPractice kategoria={ctx.kategoria} />} />
          <Route
            path="nauka/testy"
            element={
              <SimulationSection
                oskId={oskId!}
                enrollmentId={ctx.enrollmentId}
                kategoria={ctx.kategoria}
              />
            }
          />
          <Route
            path="ranking"
            element={<RankingSection courseId={ctx.courseId} mojEnrollmentId={ctx.enrollmentId} />}
          />
          <Route path="chat" element={<ChatSection oskId={oskId!} />} />
          <Route path="dane" element={<MyDataSection enrollmentId={ctx.enrollmentId} />} />
          <Route path="pomoc" element={<KursantHelpSection />} />
        </Routes>
      </div>
    </AppShell>
  );
}
