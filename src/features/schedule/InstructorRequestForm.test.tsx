import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstructorRequestForm } from "./InstructorRequestForm";

describe("InstructorRequestForm", () => {
  it("wysyła typ i treść zgłoszenia", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InstructorRequestForm onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText("Rodzaj zgłoszenia"), "problem");
    await user.type(screen.getByLabelText("Treść"), "Auto WX123 ma awarię hamulców");
    await user.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(onSubmit).toHaveBeenCalledWith("problem", "Auto WX123 ma awarię hamulców");
    expect(screen.getByText(/zgłoszenie wysłane/i)).toBeInTheDocument();
  });

  it("blokuje pustą treść", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InstructorRequestForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /wyślij/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/opisz zgłoszenie/i)).toBeInTheDocument();
  });
});
