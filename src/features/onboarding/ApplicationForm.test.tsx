import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationForm } from "./ApplicationForm";

async function wypelnijBazowe(user: ReturnType<typeof userEvent.setup>, dataUrodzenia: string) {
  await user.type(screen.getByLabelText("Imię"), "Jan");
  await user.type(screen.getByLabelText("Nazwisko"), "Kowalski");
  await user.type(screen.getByLabelText("E-mail"), "jan@example.com");
  await user.type(screen.getByLabelText("Telefon"), "600100200");
  await user.type(screen.getByLabelText("Numer PKK"), "PKK/2026/1");
  await user.type(screen.getByLabelText("Data urodzenia"), dataUrodzenia);
}

describe("ApplicationForm (R4 UI)", () => {
  it("blokuje wysyłkę i pokazuje braki przy pustym formularzu", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ApplicationForm courseId="c1" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/zgoda RODO/i)).toBeInTheDocument();
  });

  it("wymaga zgody opiekuna dla niepełnoletniego", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ApplicationForm courseId="c1" onSubmit={onSubmit} />);

    await wypelnijBazowe(user, "2009-01-01"); // ~17 lat
    await user.click(screen.getByLabelText(/RODO/i));
    // Pole zgody opiekuna pojawia się dla niepełnoletniego, ale nie zaznaczamy.
    await user.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/uzupełnij: zgoda opiekuna/i)).toBeInTheDocument();
  });

  it("wysyła kompletne zgłoszenie pełnoletniego i pokazuje potwierdzenie", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ applicationId: "app1", status: "pending" });
    render(<ApplicationForm courseId="kurs-42" onSubmit={onSubmit} />);

    await wypelnijBazowe(user, "2000-01-01");
    await user.click(screen.getByLabelText(/RODO/i));
    await user.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "kurs-42", imie: "Jan" }),
    );
    expect(await screen.findByText(/oczekuje na zatwierdzenie/i)).toBeInTheDocument();
  });
});
