import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingView } from "./BookingView";
import type { SlotDoRezerwacji, SlotView } from "./types";

const wolne: SlotDoRezerwacji[] = [
  { instructor_id: "i1", start_ts: "2026-07-06T09:00:00+02:00", end_ts: "2026-07-06T10:00:00+02:00" },
];
const moje: SlotView[] = [
  { id: "s1", instructor_id: "i1", start_ts: "2026-07-07T09:00:00+02:00", end_ts: "2026-07-07T10:00:00+02:00", status: "zaplanowany" },
];

describe("BookingView — gating i rezerwacja (R7, R14b)", () => {
  it("bez cleared_to_drive nie pokazuje wolnych slotów ani rezerwacji", () => {
    render(
      <BookingView
        clearedToDrive={false}
        dostepneSloty={wolne}
        mojeSloty={moje}
        onBook={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/po dopuszczeniu przez biuro/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /zarezerwuj/i })).not.toBeInTheDocument();
  });

  it("z cleared_to_drive rezerwacja wywołuje onBook z wybranym slotem", async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(
      <BookingView
        clearedToDrive={true}
        dostepneSloty={wolne}
        mojeSloty={[]}
        onBook={onBook}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /zarezerwuj/i }));
    expect(onBook).toHaveBeenCalledWith(wolne[0]);
  });

  it("odwołanie zaplanowanego slotu wywołuje onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <BookingView
        clearedToDrive={true}
        dostepneSloty={[]}
        mojeSloty={moje}
        onBook={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /odwołaj/i }));
    expect(onCancel).toHaveBeenCalledWith(moje[0]);
  });
});
