import { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import PendingPage from './pages/PendingPage.jsx';
import WorkersPage from './pages/WorkersPage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import TimesheetPage from './pages/TimesheetPage.jsx';
import AuditPage from './pages/AuditPage.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-meavo-bg text-meavo-grey">
        Loading…
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Layout page={page} setPage={setPage}>
      {page === 'dashboard' && <DashboardPage />}
      {page === 'reports' && <ReportsPage />}
      {page === 'pending' && <PendingPage />}
      {page === 'workers' && <WorkersPage />}
      {page === 'cards' && <CardsPage />}
      {page === 'timesheet' && <TimesheetPage />}
      {page === 'audit' && <AuditPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
