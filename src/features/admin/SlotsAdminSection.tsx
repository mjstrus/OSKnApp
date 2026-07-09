import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteSlotAdmin,
  listCourseInstructors,
  listCourseSlots,
  updateSlotAdmin,
  SLOT_STATUSY,
  type CourseInstructorRow,
  type SlotAdminRow,
} from "./api";

// pl-PL datetime-local nie ma natywnego formatu w JS Date — ręczna konwersja tam i z powrotem.
function naDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Ręczna korekta grafiku praktyki: admin widzi wszystkie sloty kursu i może poprawić czas/instruktora/status. */
export function SlotsAdminSection({ courseId }: { courseId: string }) {
  const [sloty, setSloty] = React.useState<SlotAdminRow[]>([]);
  const [instruktorzy, setInstruktorzy] = React.useState<CourseInstructorRow[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  const odswiez = React.useCallback(async () => {
    try {
      const [s, i] = await Promise.all([listCourseSlots(courseId), listCourseInstructors(courseId)]);
      setSloty(s);
      setInstruktorzy(i);
    } catch (e) {
      setBlad((e as Error).message);
    }
  }, [courseId]);

  React.useEffect(() => {
    void odswiez();
  }, [odswiez]);

  async function zapisz(id: string, zmiany: Parameters<typeof updateSlotAdmin>[1]) {
    setBlad(null);
    try {
      await updateSlotAdmin(id, zmiany);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  async function usun(id: string) {
    if (!window.confirm("Usunąć ten slot? Tej operacji nie da się cofnąć.")) return;
    setBlad(null);
    try {
      await deleteSlotAdmin(id);
      await odswiez();
    } catch (e) {
      setBlad((e as Error).message);
    }
  }

  if (sloty.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grafik jazd — korekta</CardTitle>
        <CardDescription>
          Wszystkie sloty kursu. Popraw ręcznie, gdy auto-przydział źle dopasował — bez proszenia
          kursanta o odwołanie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {blad && <p className="text-sm text-[var(--destructive)]">{blad}</p>}
        {sloty.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded bg-[var(--muted)] px-3 py-2 text-sm"
          >
            <input
              type="datetime-local"
              defaultValue={naDatetimeLocal(s.start_ts)}
              onBlur={(e) => {
                const iso = new Date(e.target.value).toISOString();
                if (iso !== s.start_ts) void zapisz(s.id, { start_ts: iso });
              }}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs"
            />
            <select
              aria-label="Instruktor"
              defaultValue={s.instructor_id}
              onChange={(e) => void zapisz(s.id, { instructor_id: e.target.value })}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs"
            >
              {instruktorzy.map((i) => (
                <option key={i.instructor_id} value={i.instructor_id}>
                  {i.imie} {i.nazwisko}
                </option>
              ))}
            </select>
            <select
              aria-label="Status"
              defaultValue={s.status}
              onChange={(e) => void zapisz(s.id, { status: e.target.value })}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs"
            >
              {SLOT_STATUSY.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={() => usun(s.id)}>
              Usuń
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
