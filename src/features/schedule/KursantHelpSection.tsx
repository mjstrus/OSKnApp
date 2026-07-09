import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function KursantHelpSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pomoc</CardTitle>
        <CardDescription>Skrócony przewodnik po panelu kursanta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <strong>Terminarz</strong> — postęp teorii i praktyki, grafik zajęć, propozycje jazd do
          potwierdzenia/odwołania, giełda wolnych terminów i rezerwacja własnych jazd.
        </p>
        <p>
          <strong>Nauka</strong> — symulacje egzaminu.
        </p>
        <p>
          <strong>Ranking</strong> — porównanie postępów na tle innych kursantów tego kursu.
        </p>
        <p>
          <strong>Chat</strong> — kontakt z OSK.
        </p>
        <p>
          <strong>Moje dane</strong> — eksport lub usunięcie swoich danych (RODO).
        </p>
      </CardContent>
    </Card>
  );
}
