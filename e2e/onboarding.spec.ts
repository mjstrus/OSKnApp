import { expect, test } from "@playwright/test";

// Wymaga działającego projektu Supabase + istniejącego kursu z otwartymi zapisami.
// Ustaw COURSE_ID na realny id kursu przed uruchomieniem.
const COURSE_ID = process.env.COURSE_ID ?? "REPLACE_ME";

test("kandydat składa zgłoszenie z przeglądarki (R4)", async ({ page }) => {
  test.skip(COURSE_ID === "REPLACE_ME", "Ustaw COURSE_ID realnego kursu");

  await page.goto(`/apply/${COURSE_ID}`);

  await page.getByLabel("Imię").fill("Jan");
  await page.getByLabel("Nazwisko").fill("Kowalski");
  await page.getByLabel("E-mail").fill(`jan+${Date.now()}@example.com`);
  await page.getByLabel("Telefon").fill("600100200");
  await page.getByLabel("Numer PKK").fill("PKK/2026/TEST");
  await page.getByLabel("Data urodzenia").fill("2000-01-01");
  await page.getByLabel(/RODO/i).check();

  await page.getByRole("button", { name: /wyślij/i }).click();

  await expect(page.getByText(/oczekuje na zatwierdzenie/i)).toBeVisible();
});
