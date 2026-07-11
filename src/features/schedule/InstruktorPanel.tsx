import * as React from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { CalendarDays, HelpCircle, Send } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell, type NavItem } from "@/app/AppShell";
import { AttendanceView } from "./AttendanceView";
import { InstructorRequestForm } from "./InstructorRequestForm";
import { InstructorRequestHistory } from "./InstructorRequestHistory";
import { InstructorHelpSection } from "./InstructorHelpSection";
import { InstructorDocsSection } from "./InstructorDocsSection";
import { InstructorWidgetLeft, InstructorWidgetRight } from "./InstructorWidgets";
import {
  confirmAttendance,
  getInstructorSlots,
  getMyInstructorId,
  listMyInstructorRequests,
  submitInstructorFeedback,
  submitInstructorRequest,
  type InstructorRequestRow,
} from "./api";
import type { SlotView } from "./types";

const NAV: NavItem[] = [
  { to: "/panel/grafik", label: "Grafik", icon: CalendarDays },
  { to: "/panel/zgloszenie", label: "Zgłoś do admina", icon: Send },
];

const headerIconClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md p-2 transition-colors ${isActive ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]"}`;

export function InstruktorPanel() {
  const { oskId } = useAuth();
  const [instructorId, setInstructorId] = React.useState<string | null>(null);
  const [sloty, setSloty] = React.useState<SlotView[]>([]);
  const [zgloszenia, setZgloszenia] = React.useState<InstructorRequestRow[]>([]);
  const [ladowanie, setLadowanie] = React.useState(true);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    if (!oskId) return;
    setLadowanie(true);
    try {
      const id = await getMyInstructorId(oskId);
      setInstructorId(id);
      if (id) {
        const [sl, zg] = await Promise.all([getInstructorSlots(id), listMyInstructorRequests(id)]);
        setSloty(sl);
        setZgloszenia(zg);
      }
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setLadowanie(false);
    }
  }, [oskId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function potwierdz(slot: SlotView) {
    setBlad(null);
    try {
      await confirmAttendance(slot.id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function ocen(slot: SlotView, ocena: number, komentarz: string) {
    if (!oskId || !instructorId) return;
    await submitInstructorFeedback({
      oskId,
      instructorId,
      enrollmentId: slot.enrollment_id,
      slotId: slot.id,
      ocena,
      komentarz,
    });
  }

  async function zglos(typ: string, tresc: string) {
    if (!oskId || !instructorId) return;
    await submitInstructorRequest({ oskId, instructorId, typ, tresc });
    await odswiez();
  }

  return (
    <AppShell
      navItems={NAV}
      headerExtra={
        <NavLink to="/panel/pomoc" className={headerIconClass} aria-label="Pomoc">
          <HelpCircle className="h-4 w-4" />
        </NavLink>
      }
      left={<InstructorWidgetLeft instructorId={instructorId} />}
      right={<InstructorWidgetRight sloty={sloty} />}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {ladowanie ? (
          <p>Ładowanie…</p>
        ) : (
          <>
            {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
            {instructorId && <InstructorDocsSection instructorId={instructorId} />}
            <Routes>
              <Route index element={<Navigate to="grafik" replace />} />
              <Route
                path="grafik"
                element={<AttendanceView sloty={sloty} onConfirm={potwierdz} onFeedback={ocen} />}
              />
              <Route
                path="zgloszenie"
                element={
                  <div className="space-y-6">
                    <InstructorRequestForm onSubmit={zglos} />
                    <InstructorRequestHistory zgloszenia={zgloszenia} />
                  </div>
                }
              />
              <Route path="pomoc" element={<InstructorHelpSection />} />
            </Routes>
          </>
        )}
      </div>
    </AppShell>
  );
}
