import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { PERIOD_LABELS, type Period, useFiltersStore } from '../store/filters';

const periods = Object.keys(PERIOD_LABELS) as Period[];

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { period, setPeriod } = useFiltersStore();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
    queryClient.clear();
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◆</span> FinSight
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-name">{user?.name}</div>
          <div className="user-email">{user?.email}</div>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Period">
            {periods.map((p) => (
              <button key={p} className={p === period ? 'active' : ''} onClick={() => setPeriod(p)}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
