import { describe, expect, it } from "vitest";
import { zbudujLeaderboard } from "./leaderboard";
import type { PodejscieSymulacji } from "./leaderboard";

describe("zbudujLeaderboard — ranking kursu (R17)", () => {
  it("porządkuje po najlepszym wyniku symulacji malejąco", () => {
    const podejscia: PodejscieSymulacji[] = [
      { enrollmentId: "a", punkty: 60 },
      { enrollmentId: "b", punkty: 74 },
      { enrollmentId: "c", punkty: 68 },
    ];
    const l = zbudujLeaderboard(podejscia);
    expect(l.map((p) => p.enrollmentId)).toEqual(["b", "c", "a"]);
    expect(l.map((p) => p.pozycja)).toEqual([1, 2, 3]);
  });

  it("bierze NAJLEPSZY wynik danego kursanta, nie ostatni", () => {
    const podejscia: PodejscieSymulacji[] = [
      { enrollmentId: "a", punkty: 40 },
      { enrollmentId: "a", punkty: 72 },
      { enrollmentId: "a", punkty: 55 },
    ];
    const l = zbudujLeaderboard(podejscia);
    expect(l).toHaveLength(1);
    expect(l[0]!.najlepszyWynik).toBe(72);
    expect(l[0]!.liczbaTestow).toBe(3);
  });

  it("tie-break: przy równym wyniku wyżej ten z większą liczbą testów", () => {
    const podejscia: PodejscieSymulacji[] = [
      { enrollmentId: "a", punkty: 70 },
      { enrollmentId: "b", punkty: 70 },
      { enrollmentId: "b", punkty: 50 },
    ];
    const l = zbudujLeaderboard(podejscia);
    expect(l.map((p) => p.enrollmentId)).toEqual(["b", "a"]);
    expect(l[0]!.liczbaTestow).toBe(2);
    expect(l[1]!.liczbaTestow).toBe(1);
  });

  it("pełny remis (wynik i liczba testów) → ta sama pozycja (ranking sportowy)", () => {
    const podejscia: PodejscieSymulacji[] = [
      { enrollmentId: "a", punkty: 70 },
      { enrollmentId: "b", punkty: 70 },
      { enrollmentId: "c", punkty: 50 },
    ];
    const l = zbudujLeaderboard(podejscia);
    const a = l.find((p) => p.enrollmentId === "a")!;
    const b = l.find((p) => p.enrollmentId === "b")!;
    const c = l.find((p) => p.enrollmentId === "c")!;
    expect(a.pozycja).toBe(1);
    expect(b.pozycja).toBe(1);
    expect(c.pozycja).toBe(3); // po dwóch remisujących na 1. miejscu
  });

  it("pusta lista podejść → pusty leaderboard", () => {
    expect(zbudujLeaderboard([])).toEqual([]);
  });
});
