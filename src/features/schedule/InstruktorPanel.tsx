import * as React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell } from "@/app/AppShell";
import { AttendanceView } from "./AttendanceView";
import { InstructorRequestForm } from "./InstructorRequestForm";
import {
  confirmAttendance,
  getInstructorSlots,
  getMyInstructorId,
  submitInstructorRequest,
} from "./api";
import type { SlotView } from "./types";

const NAV = [
  { to: "/panel/grafik", label: "Grafik" },
  { to: "/panel/zgloszenie", label: "Zgłoś do admina" },
];

export function InstruktorPanel() {
  const { oskId } = useAuth();
  const [instructorId, setInstructorId] = React.useState<string | null>(null);
  const [sloty, setSloty] = React.useState<SlotView[]>([]);
  const [ladowanie, setLadowanie] = React.useState(true);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    if (!oskId) return;
    setLadowanie(true);
    try {
      const id = await getMyInstructorId(oskId);
      setInstructorId(id);
      setSloty(id ? await getInstructorSlots(id) : []);
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

  async function zglos(typ: string, tresc: string) {
    if (!oskId || !instructorId) return;
    await submitInstructorRequest({ oskId, instructorId, typ, tresc });
  }

  return (
    <AppShell navItems={NAV}>
      <div className="mx-auto max-w-2xl space-y-4">
        {ladowanie ? (
          <p>Ładowanie…</p>
        ) : (
          <>
            {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
            <Routes>
              <Route index element={<Navigate to="grafik" replace />} />
              <Route
                path="grafik"
                element={<AttendanceView sloty={sloty} onConfirm={potwierdz} />}
              />
              <Route path="zgloszenie" element={<InstructorRequestForm onSubmit={zglos} />} />
            </Routes>
          </>
        )}
      </div>
    </AppShell>
  );
}
