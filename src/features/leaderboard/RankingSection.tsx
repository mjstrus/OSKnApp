import * as React from "react";
import { LeaderboardView } from "./LeaderboardView";
import { fetchCourseLeaderboard } from "./api";
import type { PozycjaLeaderboard } from "@/engine/leaderboard";

export function RankingSection({
  courseId,
  mojEnrollmentId,
}: {
  courseId: string;
  mojEnrollmentId: string;
}) {
  const [pozycje, setPozycje] = React.useState<PozycjaLeaderboard[]>([]);
  const [blad, setBlad] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchCourseLeaderboard(courseId).then(setPozycje).catch((e) => setBlad((e as Error).message));
  }, [courseId]);

  if (blad) return <p className="p-2 text-sm text-[var(--destructive)]">{blad}</p>;
  return <LeaderboardView pozycje={pozycje} mojEnrollmentId={mojEnrollmentId} />;
}
