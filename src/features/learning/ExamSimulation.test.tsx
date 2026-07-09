import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ExamSimulation } from "./ExamSimulation";
import { EGZAMIN_WORD_B, type Pytanie } from "@/engine/exam";

const pytania: Pytanie[] = [
  { id: "q1", kategoria: "B", typ: "podstawowe", waga: 3, poprawna: "TAK" },
  { id: "q2", kategoria: "B", typ: "specjalistyczne", waga: 2, poprawna: "A" },
];
const config = { ...EGZAMIN_WORD_B, czasSekundy: 3, progZaliczenia: 3, maxPkt: 5 };

describe("ExamSimulation (R16 UI)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("liczy wynik po ręcznym zakończeniu", () => {
    const onFinish = vi.fn();
    render(<ExamSimulation pytania={pytania} config={config} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole("radio", { name: "TAK" })); // q1 poprawnie (3)
    fireEvent.click(screen.getByRole("button", { name: /zakończ/i }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    const [wynik] = onFinish.mock.calls[0]!;
    expect(wynik.punkty).toBe(3);
    expect(wynik.zaliczony).toBe(true); // próg 3
  });

  it("limit czasu wymusza zakończenie po upływie czasu", () => {
    const onFinish = vi.fn();
    render(<ExamSimulation pytania={pytania} config={config} onFinish={onFinish} />);

    act(() => {
      vi.advanceTimersByTime(3000); // czasSekundy = 3
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("timer")).toHaveTextContent("00:00");
  });

  it("nie wywołuje onFinish podwójnie (czas + ręczne)", () => {
    const onFinish = vi.fn();
    render(<ExamSimulation pytania={pytania} config={config} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole("button", { name: /zakończ/i }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
