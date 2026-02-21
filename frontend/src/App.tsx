import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import CompanySetupPage from './pages/CompanySetupPage';
import UploadDataPage from './pages/UploadDataPage';
import BuildTwinPage from './pages/BuildTwinPage';
import DashboardPage from './pages/DashboardPage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f0f2f5',
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Not logged in → login page
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Logged in but no company → company setup
  if (!user.company_id) {
    return (
      <Routes>
        <Route path="/company-setup" element={<CompanySetupPage />} />
        <Route path="*" element={<Navigate to="/company-setup" replace />} />
      </Routes>
    );
  }

  // Fully onboarded
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/upload" element={<UploadDataPage />} />
      <Route path="/build-twin" element={<BuildTwinPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
