import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatWindow, type Wiadomosc } from "./ChatWindow";

const wiadomosci: Wiadomosc[] = [
  { id: "1", tresc: "Dzień dobry", odMnie: false },
  { id: "2", tresc: "Witam", odMnie: true },
];

describe("ChatWindow (R15 UI)", () => {
  it("renderuje wiadomości obu stron", () => {
    render(<ChatWindow wiadomosci={wiadomosci} onSend={vi.fn()} />);
    expect(screen.getByText("Dzień dobry")).toBeInTheDocument();
    expect(screen.getByText("Witam")).toBeInTheDocument();
  });

  it("wysyła treść i czyści pole", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatWindow wiadomosci={[]} onSend={onSend} />);

    const pole = screen.getByLabelText("Treść wiadomości");
    await user.type(pole, "Kiedy jazda?");
    await user.click(screen.getByRole("button", { name: /wyślij/i }));

    expect(onSend).toHaveBeenCalledWith("Kiedy jazda?");
    expect(pole).toHaveValue("");
  });

  it("nie wysyła pustej wiadomości", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatWindow wiadomosci={[]} onSend={onSend} />);
    await user.click(screen.getByRole("button", { name: /wyślij/i }));
    expect(onSend).not.toHaveBeenCalled();
  });
});
