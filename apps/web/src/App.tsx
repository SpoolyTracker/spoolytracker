import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { NFCBridgeProvider } from './contexts/NFCBridgeContext';
import { PrinterBridgeProvider } from './contexts/PrinterBridgeContext';
import { TourProvider } from './contexts/TourContext';
import MainLayout from './layout/MainLayout';
import { CompleteSignupModal } from './components/modals/CompleteSignupModal';


import DashboardPage from './pages/Dashboard';
import InventoryPage from './pages/Inventory';
import ScanPage from './pages/Scan';
import SettingsPage from './pages/Settings';
import AdminLayout from './pages/admin/AdminLayout';
import UsersTab from './pages/admin/UsersTab';
import OrganizationsTab from './pages/admin/OrganizationsTab';
import StatisticsTab from './pages/admin/StatisticsTab';
import NotificationsTab from './pages/admin/NotificationsTab';
import SubscriptionsTab from './pages/admin/SubscriptionsTab';
import AuditLogTab from './pages/admin/AuditLogTab';
import SettingsTab from './pages/admin/SettingsTab';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import VerifyEmailPage from './pages/VerifyEmail';
import ForgotPasswordPage from './pages/ForgotPassword';
import ResetPasswordPage from './pages/ResetPassword';

import SuperAdminFilaments from './pages/SuperAdminFilaments';
import ConsumptionPage from './pages/Consumption';
import ReferenceData from './pages/ReferenceData';
import TigerTagAdminPage from './pages/TigerTagAdmin';
import LegalPage from './pages/Legal';
import ProjectsPage from './pages/Projects';
import ProjectDetailsPage from './pages/ProjectDetails';
import ProjectFormPage from './pages/ProjectForm';
import ResolveQuotaPage from './pages/ResolveQuota';
import QuotaGuard from './components/QuotaGuard';

// --- Protected Route Component ---
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// --- Main App ---
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/resolve-quota" element={<ProtectedRoute><ResolveQuotaPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><QuotaGuard><MainLayout><DashboardPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><QuotaGuard><MainLayout><InventoryPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute><QuotaGuard><MainLayout><ScanPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><QuotaGuard><MainLayout><SettingsPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><QuotaGuard><MainLayout><AdminLayout /></MainLayout></QuotaGuard></ProtectedRoute>}>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersTab />} />
        <Route path="organizations" element={<OrganizationsTab />} />
        <Route path="statistics" element={<StatisticsTab />} />
        <Route path="notifications" element={<NotificationsTab />} />
        <Route path="subscriptions" element={<SubscriptionsTab />} />
        <Route path="audit-log" element={<AuditLogTab />} />
        <Route path="settings" element={<SettingsTab />} />
      </Route>
      <Route path="/admin/filaments" element={<ProtectedRoute><QuotaGuard><MainLayout><SuperAdminFilaments /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/consumption" element={<ProtectedRoute><QuotaGuard><MainLayout><ConsumptionPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/reference-data" element={<ProtectedRoute><QuotaGuard><MainLayout><ReferenceData /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/admin/tigertag" element={<ProtectedRoute><QuotaGuard><MainLayout><TigerTagAdminPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><QuotaGuard><MainLayout><ProjectsPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/projects/new" element={<ProtectedRoute><QuotaGuard><MainLayout><ProjectFormPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><QuotaGuard><MainLayout><ProjectDetailsPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/projects/:id/edit" element={<ProtectedRoute><QuotaGuard><MainLayout><ProjectFormPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
      <Route path="/legal" element={<ProtectedRoute><QuotaGuard><MainLayout><LegalPage /></MainLayout></QuotaGuard></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NFCBridgeProvider>
          <PrinterBridgeProvider>
            <NotificationProvider>
              <BrowserRouter>
                <TourProvider>
                  <AppRoutes />
                  <CompleteSignupModalWrapper />
                </TourProvider>
              </BrowserRouter>
            </NotificationProvider>
          </PrinterBridgeProvider>
        </NFCBridgeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function CompleteSignupModalWrapper() {
  const { user, activeOrganizationId } = useAuth();
  
  // Open if user is partially signed up OR if they somehow don't have an organization
  const isOpen = !!user && (!!user.needsUsername || !activeOrganizationId);
  
  return <CompleteSignupModal open={isOpen} />;
}


export default App;
