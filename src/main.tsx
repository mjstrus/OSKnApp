import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AppRouter } from "@/app/router";
import { podepnijGlobalnyLogBledow } from "@/lib/errorLog";

podepnijGlobalnyLogBledow();

if (localStorage.getItem("osknapp_theme") === "dark") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </StrictMode>,
);
