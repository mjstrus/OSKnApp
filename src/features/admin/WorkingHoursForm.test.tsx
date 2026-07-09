import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkingHoursForm } from "./WorkingHoursForm";

describe("WorkingHoursForm — wiele dni naraz (fix: zapisywał się tylko jeden dzień)", () => {
  it("zaznaczenie kilku dni wysyła je wszystkie w jednym wywołaniu", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WorkingHoursForm onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText("Poniedziałek"));
    await user.click(screen.getByLabelText("Środa"));
    await user.click(screen.getByLabelText("Piątek"));
    await user.click(screen.getByRole("button", { name: /dodaj godziny/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ dni: [0, 2, 4], od_godz: "08:00", do_godz: "16:00" });
  });

  it("blokuje wysyłkę bez zaznaczonego dnia", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WorkingHoursForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /dodaj godziny/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/wybierz co najmniej jeden dzień/i)).toBeInTheDocument();
  });

  it("preset 'Dni robocze' zaznacza pon-pt bez klikania każdego dnia", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WorkingHoursForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /dni robocze/i }));
    await user.click(screen.getByRole("button", { name: /dodaj godziny/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      dni: [0, 1, 2, 3, 4],
      od_godz: "08:00",
      do_godz: "16:00",
    });
  });

  it("preset 'Wszystkie dni' zaznacza 7 dni jednym kliknięciem", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WorkingHoursForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /wszystkie dni/i }));
    await user.click(screen.getByRole("button", { name: /dodaj godziny/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      dni: [0, 1, 2, 3, 4, 5, 6],
      od_godz: "08:00",
      do_godz: "16:00",
    });
  });

  it("czyści zaznaczone dni po udanym zapisie", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WorkingHoursForm onSubmit={onSubmit} />);
    const poniedzialek = screen.getByLabelText("Poniedziałek") as HTMLInputElement;
    await user.click(poniedzialek);
    await user.click(screen.getByRole("button", { name: /dodaj godziny/i }));
    expect(poniedzialek.checked).toBe(false);
  });
});
