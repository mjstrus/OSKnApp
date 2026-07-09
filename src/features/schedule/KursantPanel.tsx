import * as React from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BookOpen, CalendarDays, HelpCircle, MessageCircle, Trophy, User } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell, type NavItem } from "@/app/AppShell";
import { HoursProgress } from "@/features/progress/HoursProgress";
import { TheoryProgress } from "@/features/progress/TheoryProgress";
import { SimulationSection } from "@/features/learning/SimulationSection";
import { RankingSection } from "@/features/leaderboard/RankingSection";
import { ChatSection } from "@/features/chat/ChatSection";
import { BookingView } from "./BookingView";
import { PracticeSchedule } from "./PracticeSchedule";
import { AvailabilitySection } from "./AvailabilitySection";
import { TheorySchedule } from "./TheorySchedule";
import { MyDataSection } from "./MyDataSection";
import { KursantHelpSection } from "./KursantHelpSection";
import { KursantWidgetLeft, KursantWidgetRight } from "./KursantWidgets";
import { bookSlot, cancelSlot, getKursantContext, type KursantContext } from "./api";
import type { SlotDoRezerwacji, SlotView } from "./types";

const NAV: NavItem[] = [
  { to: "/panel/terminarz", label: "Terminarz", icon: CalendarDays },
  { to: "/panel/nauka", label: "Nauka", icon: BookOpen },
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
                <HoursProgress stan={ctx.stan} />
                <TheoryProgress courseId={ctx.courseId} />
                <TheorySchedule courseId={ctx.courseId} />
                <PracticeSchedule enrollmentId={ctx.enrollmentId} courseId={ctx.courseId} />
                <AvailabilitySection oskId={oskId!} enrollmentId={ctx.enrollmentId} />
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
            path="nauka"
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
          <Route path="dane" element={<MyDataSection />} />
          <Route path="pomoc" element={<KursantHelpSection />} />
        </Routes>
      </div>
    </AppShell>
  );
}
