import { supabase } from "@/lib/supabase";
import { zbudujLeaderboard, type PozycjaLeaderboard } from "@/engine/leaderboard";

/**
 * Ranking kursu (R17). RLS (0005) zwraca podejścia symulacji własne i kolegów
 * z kursu; agregację i porządek liczy silnik.
 */
export async function fetchCourseLeaderboard(courseId: string): Promise<PozycjaLeaderboard[]> {
  // Uwaga: FK złożony (enrollment_id, osk_id) -> enrollment(id, osk_id); embed
  // po nazwie tabeli, nie po aliasie kolumny (PostgREST inaczej nie znajduje relacji).
  const { data, error } = await supabase
    .from("test_attempt")
    .select("enrollment_id, punkty, enrollment!inner(course_id)")
    .eq("tryb", "symulacja")
    .eq("enrollment.course_id", courseId)
    .not("punkty", "is", null);
  if (error) throw error;

  const podejscia = (data ?? []).map((r) => ({
    enrollmentId: r.enrollment_id as string,
    punkty: r.punkty as number,
  }));
  return zbudujLeaderboard(podejscia);
}
