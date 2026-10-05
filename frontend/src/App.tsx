import { useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { Toaster } from 'react-hot-toast'
import { getTheme } from './theme'
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeModeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'

// Auth pages
import Landing from './pages/auth/Landing'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ImpersonateEntry from './pages/auth/ImpersonateEntry'

// Client pages
import Dashboard from './pages/client/Dashboard'
import FacturesAchats from './pages/client/FacturesAchats'
import FacturesVentes from './pages/client/FacturesVentes'
import RelevesBancaires from './pages/client/RelevesBancaires'
import DeclarationsFiscales from './pages/client/DeclarationsFiscales'
import DeclarationsSociales from './pages/client/DeclarationsSociales'
import EcheancierLeasing from './pages/client/EcheancierLeasing'
import AuditIntelligent from './pages/client/AuditIntelligent'
import Messagerie from './pages/client/Messagerie'
import Profile from './pages/client/Profile'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminClients from './pages/admin/AdminClients'
import AdminClientDossier from './pages/admin/AdminClientDossier'
import AdminDocuments from './pages/admin/AdminDocuments'
import AdminRapports from './pages/admin/AdminRapports'
import AdminAudit from './pages/admin/AdminAudit'
import AdminTextesLois from './pages/admin/AdminTextesLois'
import AdminMessagerie from './pages/admin/AdminMessagerie'
import AdminSettings from './pages/admin/AdminSettings'
import AdminTickets from './pages/admin/AdminTickets'

function AuditPage() {
  const { user } = useAuth()
  const realRole = sessionStorage.getItem('real_role') ?? user?.role
  return realRole === 'admin' ? <AdminAudit /> : <AuditIntelligent />
}

function ThemedApp() {
  const { mode } = useThemeMode()
  const theme = useMemo(() => getTheme(mode), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <CurrencyProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/impersonate" element={<ImpersonateEntry />} />

            {/* Client routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><Dashboard /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/achats" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><FacturesAchats /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/ventes" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><FacturesVentes /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/releves" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><RelevesBancaires /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/fiscales" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><DeclarationsFiscales /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/sociales" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><DeclarationsSociales /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/leasing" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><EcheancierLeasing /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/audit" element={
              <ProtectedRoute>
                <DashboardLayout><AuditPage /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute allowedRole="client">
                <DashboardLayout><Messagerie /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/profil" element={
              <ProtectedRoute>
                <DashboardLayout><Profile /></DashboardLayout>
              </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminDashboard /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/clients" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminClients /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/clients/:id/dossier" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminClientDossier /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/documents" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminDocuments /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/rapports" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminRapports /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/textes-lois" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminTextesLois /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/messages" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminMessagerie /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/tickets" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminTickets /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/audit" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminAudit /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout><AdminSettings /></DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </CurrencyProvider>
        <Toaster position="top-right"
          toastOptions={{ style: { fontFamily: 'Inter', fontWeight: 600, borderRadius: 12 } }} />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  )
}