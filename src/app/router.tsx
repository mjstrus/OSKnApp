import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { Panel } from "@/app/Panel";
import { ApplicationForm } from "@/features/onboarding/ApplicationForm";

function Chroniona({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="p-6">Ładowanie…</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ApplicationRoute() {
  const { courseId } = useParams();
  if (!courseId) return <Navigate to="/" replace />;
  return <ApplicationForm courseId={courseId} />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-hasla" element={<ResetPasswordPage />} />
        <Route path="/apply/:courseId" element={<ApplicationRoute />} />
        <Route
          path="/panel/*"
          element={
            <Chroniona>
              <Panel />
            </Chroniona>
          }
        />
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
