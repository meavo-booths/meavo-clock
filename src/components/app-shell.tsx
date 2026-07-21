"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Home", short: "Home" },
  { href: "/pending", label: "Requests", short: "Requests" },
  { href: "/reports", label: "Hours", short: "Hours" },
];

const MORE_NAV = [
  { href: "/workers", label: "Workers" },
  { href: "/cards", label: "Cards" },
  { href: "/timesheet", label: "Timesheet" },
  { href: "/audit", label: "Unassigned taps" },
];

function NavLinks({
  pathname,
  onNavigate,
  items,
}: {
  pathname: string;
  onNavigate?: () => void;
  items: { href: string; label: string }[];
}) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`nav-link min-h-11 ${pathname === item.href || pathname.startsWith(item.href + "/") ? "nav-link-active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_NAV.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  return (
    <div className="flex min-h-screen flex-col bg-meavo-bg">
      {/* Top bar — mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-meavo-beige-600 bg-meavo-beige px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-meavo-accent">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-meavo-ink">Clock-In</p>
            <p className="text-[11px] text-meavo-grey">07:30–16:30</p>
          </div>
        </div>
      </header>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col bg-meavo-beige p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold text-meavo-ink">Menu</span>
              <button
                type="button"
                className="btn-secondary min-h-11 px-3 text-xs"
                onClick={() => setMoreOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <NavLinks
                pathname={pathname}
                onNavigate={() => setMoreOpen(false)}
                items={[...PRIMARY_NAV, ...MORE_NAV]}
              />
            </nav>
            <div className="mt-auto border-t border-meavo-beige-600 pt-4">
              <p className="truncate text-xs text-meavo-grey">{session?.user?.email}</p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="mt-2 min-h-11 text-sm text-meavo-accent"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-meavo-beige-600 bg-meavo-beige p-4 lg:flex">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-meavo-accent">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="font-semibold text-meavo-ink">Clock-In</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-meavo-grey">
              Today
            </p>
            <NavLinks pathname={pathname} items={PRIMARY_NAV} />
            <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wide text-meavo-grey">
              Manage
            </p>
            <NavLinks pathname={pathname} items={MORE_NAV} />
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

        <main className="flex-1 overflow-auto px-4 py-5 pb-24 sm:px-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-meavo-beige-600 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
          {PRIMARY_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-medium ${
                  active ? "bg-meavo-accent/10 text-meavo-accent" : "text-meavo-grey"
                }`}
              >
                {item.short}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-medium ${
              moreActive ? "bg-meavo-accent/10 text-meavo-accent" : "text-meavo-grey"
            }`}
          >
            More
          </button>
        </div>
      </nav>

      <footer className="hidden bg-meavo-ink px-8 py-3 text-center text-xs text-meavo-beige-300 lg:block">
        Meavo Clock-In · Shift 07:30–16:30
      </footer>
    </div>
  );
}
