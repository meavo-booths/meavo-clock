import { useAuth } from '../AuthContext.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'pending', label: 'Pending UIDs' },
  { id: 'workers', label: 'Workers' },
  { id: 'cards', label: 'Cards' },
  { id: 'timesheet', label: 'Timesheet' },
  { id: 'audit', label: 'Unassigned Taps' },
];

export default function Layout({ page, setPage, children }) {
  const { user, logout } = useAuth();

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
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={`nav-link ${page === item.id ? 'nav-link-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-4 border-t border-meavo-beige-600 pt-4">
            <p className="truncate text-xs text-meavo-grey">{user?.email}</p>
            <button type="button" onClick={logout} className="mt-2 text-xs text-meavo-accent hover:underline">
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

export { NAV };
