import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HoursProgress } from "./HoursProgress";
import { stanPoczatkowy } from "@/engine/hours";
import type { StanKursanta } from "@/engine/types";

describe("HoursProgress (R13, R14b UI)", () => {
  it("pokazuje licznik X / cel i połowę paska przy 15/30", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), potwierdzone: 15, oplaconePozostale: 15 };
    render(<HoursProgress stan={stan} />);
    expect(screen.getByTestId("licznik")).toHaveTextContent("15 / 30 h");
    expect(screen.getByTestId("pasek")).toHaveStyle({ width: "50%" });
  });

  it("przy 30/30 pokazuje dopuszczenie do egzaminu", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), potwierdzone: 30, oplaconePozostale: 0 };
    render(<HoursProgress stan={stan} />);
    expect(screen.getByText(/dopuszczony do egzaminu/i)).toBeInTheDocument();
  });

  it("gdy pula nie starcza do celu, sygnalizuje wymagany dokup", () => {
    const stan: StanKursanta = { ...stanPoczatkowy(30), potwierdzone: 0, oplaconePozostale: 29 };
    render(<HoursProgress stan={stan} />);
    expect(screen.getByText(/wymagany dokup: 1 h/i)).toBeInTheDocument();
  });
});
