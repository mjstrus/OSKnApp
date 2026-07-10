import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InstructorHelpSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pomoc</CardTitle>
        <CardDescription>Skrócony przewodnik po panelu instruktora.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <strong>Grafik</strong> — Twoje zaplanowane jazdy. Potwierdź obecność po jeździe, opcjonalnie
          oceń kursanta (ocena widoczna tylko dla admina).
        </p>
        <p>
          <strong>Zgłoś do admina</strong> — urlop, usterka, prośba o zmianę grafiku. Poniżej formularza
          widać status Twoich wcześniejszych zgłoszeń.
        </p>
      </CardContent>
    </Card>
  );
}
