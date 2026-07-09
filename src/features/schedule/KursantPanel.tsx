import * as React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell } from "@/app/AppShell";
import { HoursProgress } from "@/features/progress/HoursProgress";
import { SimulationSection } from "@/features/learning/SimulationSection";
import { RankingSection } from "@/features/leaderboard/RankingSection";
import { ChatSection } from "@/features/chat/ChatSection";
import { BookingView } from "./BookingView";
import { PracticeSchedule } from "./PracticeSchedule";
import { AvailabilitySection } from "./AvailabilitySection";
import { TheorySchedule } from "./TheorySchedule";
import { MyDataSection } from "./MyDataSection";
import { bookSlot, cancelSlot, getKursantContext, type KursantContext } from "./api";
import type { SlotDoRezerwacji, SlotView } from "./types";

const NAV = [
  { to: "/panel/terminarz", label: "Terminarz" },
  { to: "/panel/nauka", label: "Nauka" },
  { to: "/panel/ranking", label: "Ranking" },
  { to: "/panel/chat", label: "Chat" },
  { to: "/panel/dane", label: "Moje dane" },
];

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
    <AppShell navItems={NAV}>
      <div className="mx-auto max-w-2xl space-y-4">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}

        <Routes>
          <Route index element={<Navigate to="terminarz" replace />} />
          <Route
            path="terminarz"
            element={
              <div className="space-y-6">
                <HoursProgress stan={ctx.stan} />
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
        </Routes>
      </div>
    </AppShell>
  );
}
