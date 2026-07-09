import * as React from "react";
import { getCourse, listTheorySessions } from "@/features/admin/api";

/** Pasek postępu teorii — wg dat już odbytych sesji z grafiku (brak frekwencji per-kursant w bazie). */
export function TheoryProgress({ courseId }: { courseId: string }) {
  const [hTeoria, setHTeoria] = React.useState<number | null>(null);
  const [odbyte, setOdbyte] = React.useState(0);

  React.useEffect(() => {
    void getCourse(courseId).then((k) => setHTeoria(k?.h_teoria ?? null));
    void listTheorySessions(courseId).then((sesje) => {
      const teraz = Date.now();
      setOdbyte(
        sesje.filter((s) => new Date(s.end_ts).getTime() < teraz).reduce((s, x) => s + x.liczba_godzin, 0),
      );
    });
  }, [courseId]);

  if (!hTeoria) return null;
  const procent = Math.min(100, Math.round((odbyte / hTeoria) * 100));

  return (
    <div className="space-y-2" role="group" aria-label="Postęp teorii">
      <div className="flex justify-between text-sm">
        <span>Godziny teorii</span>
        <span>
          {odbyte} / {hTeoria} h
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${procent}%` }} />
      </div>
    </div>
  );
}
