"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, logout } from "@/lib/api";

const healthLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/weight", label: "Weight" },
  { href: "/workouts", label: "Workouts" },
  { href: "/food", label: "Food" },
];

const financesLinks = [
  { href: "/finances/cash-flow", label: "Cash Flow" },
  { href: "/finances/analytics", label: "Daily Budget" },
  { href: "/finances/net-worth", label: "Net Worth" },
  { href: "/finances/roth", label: "Investments" },
  { href: "/finances/research", label: "Research" },
  { href: "/finances/accounts", label: "Accounts" },
];

const apartmentsLinks = [{ href: "/apartments", label: "Compare" }];

type Scope = "health" | "finances" | "apartments";

function scopeOf(pathname: string): Scope {
  if (pathname.startsWith("/finances")) return "finances";
  if (pathname.startsWith("/apartments")) return "apartments";
  return "health";
}

const SUBLINKS: Record<Scope, { href: string; label: string }[]> = {
  health: healthLinks,
  finances: financesLinks,
  apartments: apartmentsLinks,
};

const SCOPES: { scope: Scope; href: string; label: string; icon: React.ReactNode }[] = [
  {
    scope: "health",
    href: "/",
    label: "Health",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <path
          d="M1.5 8h3l1.5-4 2.5 8L10 6l1 2h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    scope: "finances",
    href: "/finances/cash-flow",
    label: "Finances",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6.2c-.4-.6-1.1-1-2-1-1.2 0-2 .7-2 1.5 0 2 4 1 4 2.8 0 .8-.8 1.5-2 1.5-.9 0-1.6-.4-2-1M8 4.2v1M8 11v.9"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    scope: "apartments",
    href: "/apartments",
    label: "Apartments",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <path
          d="M2.5 13.5V4.4a1 1 0 0 1 .6-.9l4-1.8a1 1 0 0 1 1.4.9v10.9M8.5 6.5h4a1 1 0 0 1 1 1v6M1 13.5h14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M5 6h1M5 8.5h1M11 9h1M11 11h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, [pathname]);

  if (pathname === "/login") return null;

  const scope = scopeOf(pathname);
  const subLinks = SUBLINKS[scope];

  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-gray-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-700 shadow-glow">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-white" aria-hidden>
                <path
                  d="M2 9.5 6 5l3 3 5-5.5M14 2.5v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight text-gray-50">
              My Dashboard
            </span>
          </Link>
          <div className="hidden items-center gap-1 rounded-xl border border-white/[0.06] bg-gray-900/60 p-1 sm:flex">
            {SCOPES.map((s) => (
              <Link
                key={s.scope}
                href={s.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  scope === s.scope
                    ? "bg-white/[0.08] text-gray-50 shadow"
                    : "text-gray-500 hover:text-gray-200"
                }`}
              >
                <span className={scope === s.scope ? "text-blue-400" : ""}>{s.icon}</span>
                {s.label}
              </Link>
            ))}
          </div>
        </div>
        {authed && (
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200"
          >
            Sign out
          </button>
        )}
      </div>

      {/* Mobile scope switcher */}
      <div className="flex items-center gap-1 overflow-x-auto px-5 pb-2 sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SCOPES.map((s) => (
          <Link
            key={s.scope}
            href={s.href}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              scope === s.scope ? "bg-white/[0.08] text-gray-50" : "text-gray-500"
            }`}
          >
            {s.icon}
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mx-auto flex h-11 max-w-screen-2xl items-center gap-1 overflow-x-auto px-5 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {subLinks.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative flex h-full flex-shrink-0 items-center px-3 text-sm transition-colors ${
                active ? "font-medium text-gray-50" : "text-gray-500 hover:text-gray-200"
              }`}
            >
              {l.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-500 shadow-glow" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
