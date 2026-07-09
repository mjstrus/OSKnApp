import * as React from "react";
import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  submenu?: { to: string; label: string }[];
}

interface Props {
  navItems: NavItem[];
  children: React.ReactNode;
  /** Opcjonalne kolumny po bokach głównej treści (np. widgety admina) i dodatkowy przycisk w nagłówku. */
  left?: React.ReactNode;
  right?: React.ReactNode;
  headerExtra?: React.ReactNode;
}

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
    isActive
      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
      : "text-[var(--foreground)] hover:bg-[var(--muted)]",
  );

const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
    isActive
      ? "bg-[var(--sidebar-active)] text-white"
      : "text-[var(--sidebar-foreground)] hover:bg-white/10",
  );

/**
 * Wspólna powłoka nawigacji: pasek zakładek u góry na mobile, menu boczne na
 * desktopie. Te same navItems renderują się w obu układach (CSS-only
 * przełączanie, bez logiki JS na breakpoint).
 */
export function AppShell({ navItems, children, left, right, headerExtra }: Props) {
  const { rola, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {navItems.length > 0 && (
        <nav className="hidden w-56 shrink-0 flex-col gap-1 bg-[var(--sidebar)] p-4 md:flex">
          <div className="mb-4 flex items-center gap-2 px-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--sidebar-active)]" />
            <span className="text-sm font-semibold text-white">OSKnAPP</span>
          </div>
          {navItems.map((item) => (
            <div key={item.to} className="group relative">
              <NavLink to={item.to} className={sidebarLinkClass}>
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </NavLink>
              {item.submenu && item.submenu.length > 0 && (
                <div className="absolute left-full top-0 z-20 ml-1 hidden w-48 flex-col rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg group-hover:flex">
                  {item.submenu.map((s) => (
                    <NavLink
                      key={s.to}
                      to={s.to}
                      className="rounded px-2 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                    >
                      {s.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:px-6">
          <span className="text-sm font-medium capitalize">{rola}</span>
          <div className="flex items-center gap-2">
            {headerExtra}
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              Wyloguj
            </Button>
          </div>
        </header>

        {navItems.length > 0 && (
          <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 md:hidden">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={mobileLinkClass}>
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex min-w-0 flex-1">
          {left}
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
          {right}
        </div>
      </div>
    </div>
  );
}
