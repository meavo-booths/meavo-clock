"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/pending", label: "Pending UIDs" },
  { href: "/workers", label: "Workers" },
  { href: "/cards", label: "Cards" },
  { href: "/timesheet", label: "Timesheet" },
  { href: "/audit", label: "Unassigned Taps" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        <aside className="flex w-56 flex-col border-r border-meavo-beige-600 bg-meavo-beige p-4">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-meavo-accent">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="font-semibold text-meavo-ink">Clock-In</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname === item.href ? "nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-meavo-beige-600 pt-4">
            <p className="truncate text-xs text-meavo-grey">{session?.user?.email}</p>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-2 text-xs text-meavo-accent hover:underline"
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
      <footer className="bg-meavo-ink px-8 py-3 text-center text-xs text-meavo-beige-300">
        Meavo Clock-In · Shift 07:30–16:30
      </footer>
    </div>
  );
}
