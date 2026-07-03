import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import LoginPage from './components/LoginPage';
import BranchDashboard from './components/BranchDashboard';
import AdminDashboard from './components/AdminDashboard';
import './index.css';

function RoleRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/branch'} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loader-screen">
        <img src="/logo.jpeg" alt="BOUTIQUE" className="loader-logo" />
        <p>Yüklənir…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <RoleRedirect /> : <LoginPage />} />
      <Route
        path="/branch"
        element={user?.role === 'branch' ? <BranchDashboard /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin"
        element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/branch') : '/login'} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SupabaseProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SupabaseProvider>
    </AuthProvider>
  );
}
