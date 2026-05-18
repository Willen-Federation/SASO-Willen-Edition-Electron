import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Labels from './pages/Labels'
import AIAgent from './pages/AIAgent'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import { useAuth } from './stores/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/// Gate every non-onboarding route on a configured `sasoServerUrl`.
///
/// On first launch the setting is empty (we removed the hardcoded default),
/// so the user lands on `/onboarding` and is asked to type or scan the
/// server URL before any auth flow can run.
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [resolved, setResolved] = useState<'pending' | 'ok' | 'missing'>('pending')
  const location = useLocation()

  useEffect(() => {
    void window.api.settings.get('sasoServerUrl').then((res) => {
      if (res.success && res.data && String(res.data).trim() !== '') {
        setResolved('ok')
      } else {
        setResolved('missing')
      }
    })
  }, [location.pathname])

  if (resolved === 'pending') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }
  if (resolved === 'missing') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  const { checkAuth } = useAuth()

  useEffect(() => {
    void checkAuth()
    const unsubCallback = window.api.auth.onAuthCallback((user) => {
      if (user) void checkAuth()
    })
    return () => unsubCallback()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/login"
        element={
          <OnboardingGate>
            <Login />
          </OnboardingGate>
        }
      />
      <Route
        path="/"
        element={
          <OnboardingGate>
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          </OnboardingGate>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="items" element={<Items />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="sales" element={<Sales />} />
        <Route path="customers" element={<Customers />} />
        <Route path="labels" element={<Labels />} />
        <Route path="ai" element={<AIAgent />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
