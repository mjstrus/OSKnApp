import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Krótka pomoc — do rozbudowy w miarę realnych pytań, nie zmyślona dokumentacja. */
export function HelpSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pomoc</CardTitle>
        <CardDescription>Skrócony przewodnik po panelu.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <strong>Kursy</strong> — dodaj kurs, kliknij kafelek żeby wejść w szczegóły, zamknij zapisy
          i wygeneruj grafik teorii/praktyki.
        </p>
        <p>
          <strong>Instruktorzy</strong> — dodaj konto, ustaw godziny pracy, przypisz do kursu.
        </p>
        <p>
          <strong>Kursanci</strong> — zatwierdzaj zgłoszenia, oznaczaj dopuszczenie do jazd i status
          płatności.
        </p>
        <p>
          <strong>Widgety</strong> po bokach ekranu przeciągnij, żeby zmienić kolejność, albo zmień typ
          wybierając z listy w rogu kafelka.
        </p>
        <p className="text-[var(--muted-foreground)]">
          Pytanie, którego tu nie ma? Napisz do wsparcia — rozbudujemy tę stronę.
        </p>
      </CardContent>
    </Card>
  );
}
