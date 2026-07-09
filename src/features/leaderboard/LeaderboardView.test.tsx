import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardView } from "./LeaderboardView";
import { zbudujLeaderboard } from "@/engine/leaderboard";

describe("LeaderboardView (R17 UI)", () => {
  const pozycje = zbudujLeaderboard([
    { enrollmentId: "a", punkty: 74 },
    { enrollmentId: "b", punkty: 60 },
  ]);

  it("renderuje kolejność i wyniki z metryki silnika", () => {
    render(<LeaderboardView pozycje={pozycje} />);
    expect(screen.getByText(/1\. Kursant/)).toBeInTheDocument();
    expect(screen.getByText(/74 pkt · 1 testów/)).toBeInTheDocument();
  });

  it("podświetla i podpisuje wiersz zalogowanego kursanta", () => {
    render(<LeaderboardView pozycje={pozycje} mojEnrollmentId="b" />);
    const moj = screen.getByTestId("moj-wiersz");
    expect(moj).toHaveTextContent("Ty");
  });

  it("pusty ranking pokazuje komunikat", () => {
    render(<LeaderboardView pozycje={[]} />);
    expect(screen.getByText(/brak wyników symulacji/i)).toBeInTheDocument();
  });
});
