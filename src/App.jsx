import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Loading from './components/ui/Loading'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Shift from './pages/Shift'
import Penjualan from './pages/Penjualan'
import Pengeluaran from './pages/Pengeluaran'

// Admin pages
import Karyawan from './pages/admin/Karyawan'
import MenuPage from './pages/admin/Menu'
import CupTypes from './pages/admin/CupTypes'
import Kategori from './pages/admin/Kategori'
import Absensi from './pages/admin/Absensi'
import StokCup from './pages/admin/StokCup'
import PengeluaranAdmin from './pages/admin/PengeluaranAdmin'
import PenjualanAdmin from './pages/admin/PenjualanAdmin'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading text="Memeriksa sesi..." />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <Login />}
      />

      {/* Protected Routes with Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Semua user */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/shift" element={<Shift />} />
        <Route path="/penjualan" element={<Penjualan />} />
        <Route path="/pengeluaran" element={<Pengeluaran />} />

        {/* Admin Only */}
        <Route
          path="/admin/karyawan"
          element={<ProtectedRoute adminOnly><Karyawan /></ProtectedRoute>}
        />
        <Route
          path="/admin/menu"
          element={<ProtectedRoute adminOnly><MenuPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/kategori"
          element={<ProtectedRoute adminOnly><Kategori /></ProtectedRoute>}
        />
        <Route
          path="/admin/cup-types"
          element={<ProtectedRoute adminOnly><CupTypes /></ProtectedRoute>}
        />
        <Route
          path="/admin/absensi"
          element={<ProtectedRoute adminOnly><Absensi /></ProtectedRoute>}
        />
        <Route
          path="/admin/stok-cup"
          element={<ProtectedRoute adminOnly><StokCup /></ProtectedRoute>}
        />
        <Route
          path="/admin/pengeluaran"
          element={<ProtectedRoute adminOnly><PengeluaranAdmin /></ProtectedRoute>}
        />
        <Route
          path="/admin/penjualan"
          element={<ProtectedRoute adminOnly><PenjualanAdmin /></ProtectedRoute>}
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}