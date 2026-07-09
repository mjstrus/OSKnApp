import { useAuth } from "@/features/auth/AuthProvider";
import { AppShell } from "@/app/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { KursantPanel } from "@/features/schedule/KursantPanel";
import { InstruktorPanel } from "@/features/schedule/InstruktorPanel";

function Placeholder({ opis }: { opis: string }) {
  return (
    <AppShell navItems={[]}>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Panel</CardTitle>
            <CardDescription>{opis}</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </AppShell>
  );
}

export function Panel() {
  const { rola } = useAuth();

  switch (rola) {
    case "admin":
      return <AdminPanel />;
    case "kursant":
      return <KursantPanel />;
    case "instruktor":
    case "instruktor_2w1":
      return <InstruktorPanel />;
    case "wykladowca":
      return <Placeholder opis="Harmonogram wykładów teorii (Unit 7)." />;
    case "kandydat":
      return <Placeholder opis="Twoje zgłoszenie oczekuje na zatwierdzenie." />;
    default:
      return <Placeholder opis="Brak przypisania do OSK." />;
  }
}
