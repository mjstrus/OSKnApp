import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CourseForm } from "./CourseForm";

describe("CourseForm (R2)", () => {
  it("wysyła sparsowany profil godzinowy z domyślnymi limitami", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CourseForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nazwa kursu"), "Kurs poranny");
    const teoria = screen.getByLabelText("Godziny teorii");
    await user.clear(teoria);
    await user.type(teoria, "30");
    await user.click(screen.getByRole("button", { name: /dodaj kurs/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      nazwa: "Kurs poranny",
      kategoria: "B",
      h_teoria: 30,
      h_praktyka: 30,
      data_poczatku: null,
      docelowy_czas_dni: null,
      min_uczestnicy: 1,
      max_uczestnicy: null,
      powiadomienie_przy_liczbie: null,
      auto_zamknij_przy_limicie: false,
      auto_zamknij_po_dniach: null,
    });
  });

  it("wysyła termin, docelowy czas i limity zapisów", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CourseForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nazwa kursu"), "Kurs wieczorny");
    await user.type(screen.getByLabelText("Planowany termin rozpoczęcia"), "2026-08-01");
    await user.type(screen.getByLabelText("Docelowy czas realizacji kursu (dni)"), "45");
    await user.type(screen.getByLabelText("Maks. uczestników"), "20");
    await user.type(screen.getByLabelText("Powiadom przy liczbie"), "15");
    await user.click(
      screen.getByLabelText(/zamknij zapisy automatycznie po osiągnięciu limitu/i),
    );
    await user.click(screen.getByRole("button", { name: /dodaj kurs/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        nazwa: "Kurs wieczorny",
        data_poczatku: "2026-08-01",
        docelowy_czas_dni: 45,
        max_uczestnicy: 20,
        powiadomienie_przy_liczbie: 15,
        auto_zamknij_przy_limicie: true,
      }),
    );
  });

  it("blokuje pustą nazwę", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CourseForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /dodaj kurs/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/podaj nazwę/i)).toBeInTheDocument();
  });

  it("blokuje max_uczestnicy mniejsze niż min_uczestnicy", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CourseForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Nazwa kursu"), "Kurs X");
    await user.type(screen.getByLabelText("Min. uczestników"), "0"); // clear then set below
    const min = screen.getByLabelText("Min. uczestników") as HTMLInputElement;
    await user.clear(min);
    await user.type(min, "10");
    await user.type(screen.getByLabelText("Maks. uczestników"), "5");
    await user.click(screen.getByRole("button", { name: /dodaj kurs/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/nie może być mniejsza niż minimalna/i)).toBeInTheDocument();
  });
});
