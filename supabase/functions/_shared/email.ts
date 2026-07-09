// Wysyłka maila przez Resend (fetch, bez SDK). Best-effort: brak klucza albo
// błąd wysyłki nigdy nie blokuje głównej operacji wołającej funkcji.
export async function wyslijEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "OSKnAPP <onboarding@resend.dev>", to, subject, html }),
  }).catch(() => {});
}
