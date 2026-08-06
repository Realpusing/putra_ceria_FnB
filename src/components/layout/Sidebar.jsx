import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard,
    Clock,
    ShoppingCart,
    Receipt,
    Users,
    BarChart3,
    Package,
    LogOut,
    Coffee,
    ChevronRight,
    Tag,           // ← tambah ini
  } from 'lucide-react'

// Menu karyawan
const menuKaryawan = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/shift', icon: Clock, label: 'Shift' },
  { to: '/penjualan', icon: ShoppingCart, label: 'Penjualan' },
  { to: '/pengeluaran', icon: Receipt, label: 'Pengeluaran' },
]

// Menu admin: umum + laporan
const menuAdminUmum = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/shift', icon: Clock, label: 'Shift' },
  { to: '/penjualan', icon: ShoppingCart, label: 'Penjualan' },
  { to: '/pengeluaran', icon: Receipt, label: 'Pengeluaran' },
]

const menuAdminLaporan = [
    { to: '/admin/absensi', icon: Users, label: 'Lap. Absensi' },
    { to: '/admin/stok-cup', icon: Package, label: 'Lap. Stok Cup' },
    { to: '/admin/pengeluaran', icon: Receipt, label: 'Lap. Pengeluaran' },
    { to: '/admin/penjualan', icon: BarChart3, label: 'Lap. Penjualan' },
    { to: '/admin/karyawan', icon: Users, label: 'Karyawan' },
    { to: '/admin/menu', icon: Coffee, label: 'Menu' },
    { to: '/admin/kategori', icon: Tag, label: 'Kategori' },      // ← tambah
    { to: '/admin/cup-types', icon: Package, label: 'Jenis Cup' },
  ]

export default function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r 
          border-gray-200 z-30 flex flex-col 
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0
        `}
      >
        {/* ── Logo ── */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-orange-500 rounded-xl 
              flex items-center justify-center shadow-lg shadow-orange-200"
            >
              <Coffee size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">Shift Manager</p>
              <p className="text-xs text-gray-400">F&B System</p>
            </div>
          </div>
        </div>

        {/* ── Info User ── */}
        <div className="px-4 py-3 mx-3 my-3 bg-orange-50 rounded-xl">
          <p className="font-semibold text-sm text-gray-800">{profile?.nama}</p>
          <p className="text-xs text-orange-600 capitalize">
            {profile?.role}
            {profile?.shift_default && ` · Shift ${profile.shift_default}`}
          </p>
        </div>

        {/* ── Menu Navigasi ── */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {/* Menu umum */}
          {(isAdmin ? menuAdminUmum : menuKaryawan).map((item) => (
            <SidebarLink key={item.to} item={item} onClose={onClose} />
          ))}

          {/* Menu admin */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                  Admin
                </p>
              </div>
              {menuAdminLaporan.map((item) => (
                <SidebarLink key={item.to} item={item} onClose={onClose} />
              ))}
            </>
          )}
        </nav>

        {/* ── Logout ── */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl 
              text-sm font-medium text-gray-500 hover:bg-red-50 
              hover:text-red-600 transition-colors w-full"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}

// ── Sub komponen link ──
function SidebarLink({ item, onClose }) {
  const { to, icon: Icon, label } = item

  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm 
        font-medium transition-colors
        ${
          isActive
            ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
            : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} />
          <span className="flex-1">{label}</span>
          {isActive && <ChevronRight size={14} />}
        </>
      )}
    </NavLink>
  )
}