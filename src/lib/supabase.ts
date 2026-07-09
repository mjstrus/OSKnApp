import { createClient } from "@supabase/supabase-js";

// Klient Supabase dla frontendu (Vite). Klucz anon jest publiczny z założenia —
// dostęp do danych ograniczają polityki RLS (supabase/migrations/0002).
//
// Po podpięciu projektu Supabase wygeneruj typy bazy i dodaj generyk:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts
//   createClient<Database>(...)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Brak konfiguracji Supabase: ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY w .env",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
