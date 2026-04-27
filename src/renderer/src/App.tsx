import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Labels from './pages/Labels'
import AIAgent from './pages/AIAgent'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { useAuth } from './stores/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { checkAuth } = useAuth()

  useEffect(() => {
    checkAuth()
    // Listen for OAuth callback
    window.api.auth.onAuthCallback((user) => {
      if (user) checkAuth()
    })
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
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
