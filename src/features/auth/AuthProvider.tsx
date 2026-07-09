import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Rola =
  | "kandydat"
  | "kursant"
  | "instruktor"
  | "wykladowca"
  | "instruktor_2w1"
  | "admin";

interface AuthState {
  session: Session | null;
  rola: Rola | null;
  oskId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [rola, setRola] = React.useState<Rola | null>(null);
  const [oskId, setOskId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    let anulowane = false;
    async function pobierzRole() {
      if (!session) {
        setRola(null);
        setOskId(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      // RLS: użytkownik czyta własne membershipy (0002). MVP: bierzemy pierwszy.
      const { data } = await supabase
        .from("membership")
        .select("osk_id, rola")
        .limit(1)
        .maybeSingle();
      if (anulowane) return;
      setRola((data?.rola as Rola) ?? null);
      setOskId((data?.osk_id as string) ?? null);
      setLoading(false);
    }
    void pobierzRole();
    return () => {
      anulowane = true;
    };
    // Zależność na id użytkownika, nie na obiekcie sesji — unika refetchów przy
    // odświeżeniu tokenu (ta sama tożsamość, nowy obiekt sesji).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, rola, oskId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi być użyte wewnątrz <AuthProvider>");
  return ctx;
}
