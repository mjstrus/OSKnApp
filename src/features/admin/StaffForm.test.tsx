import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffForm } from "./StaffForm";

async function wypelnijBazowe(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Imię"), "Anna");
  await user.type(screen.getByLabelText("Nazwisko"), "Nowak");
  await user.type(screen.getByLabelText("Numer legitymacji instruktorskiej"), "LEG/123");
  await user.type(screen.getByLabelText("E-mail"), "instruktor@osk.pl");
}

describe("StaffForm (R3)", () => {
  it("wysyła dane osobowe, e-mail i rolę (bez hasła — link dostępu wysyła Edge Function)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<StaffForm onSubmit={onSubmit} />);

    await wypelnijBazowe(user);
    await user.selectOptions(screen.getByLabelText("Rola"), "wykladowca");
    await user.click(screen.getByRole("button", { name: /dodaj personel/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "instruktor@osk.pl",
      rola: "wykladowca",
      imie: "Anna",
      nazwisko: "Nowak",
      numerLegitymacji: "LEG/123",
    });
  });

  it("blokuje brak numeru legitymacji", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<StaffForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Imię"), "Anna");
    await user.type(screen.getByLabelText("Nazwisko"), "Nowak");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await user.click(screen.getByRole("button", { name: /dodaj personel/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/podaj numer legitymacji/i)).toBeInTheDocument();
  });
});
