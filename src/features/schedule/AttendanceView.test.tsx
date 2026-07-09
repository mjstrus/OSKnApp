import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceView } from "./AttendanceView";
import type { SlotView } from "./types";

const sloty: SlotView[] = [
  { id: "s1", instructor_id: "i1", start_ts: "2026-07-06T09:00:00+02:00", end_ts: "2026-07-06T10:00:00+02:00", status: "zaplanowany" },
  { id: "s2", instructor_id: "i1", start_ts: "2026-07-05T09:00:00+02:00", end_ts: "2026-07-05T10:00:00+02:00", status: "odbyty" },
];

describe("AttendanceView — potwierdzanie obecności (R9)", () => {
  it("potwierdzenie zaplanowanego slotu wywołuje onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AttendanceView sloty={sloty} onConfirm={onConfirm} />);

    const przyciski = screen.getAllByRole("button", { name: /potwierdź obecność/i });
    expect(przyciski).toHaveLength(1); // tylko zaplanowany ma przycisk
    await user.click(przyciski[0]!);
    expect(onConfirm).toHaveBeenCalledWith(sloty[0]);
  });

  it("odbyty slot pokazuje status bez przycisku", () => {
    render(<AttendanceView sloty={sloty} onConfirm={vi.fn()} />);
    expect(screen.getByText("odbyty")).toBeInTheDocument();
  });
});
