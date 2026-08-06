import { Menu, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { formatTanggal } from '../../utils/helpers'

export default function Header({ onMenuClick }) {
  const { profile } = useAuth()

  return (
    <header
      className="bg-white border-b border-gray-200 px-4 py-3 
      flex items-center justify-between sticky top-0 z-10"
    >
      {/* Kiri */}
      <div className="flex items-center gap-3">
        {/* Tombol menu (mobile only) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} className="text-gray-600" />
        </button>

        {/* Sapaan */}
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Halo, {profile?.nama?.split(' ')[0]} 👋
          </p>
          <p className="text-xs text-gray-400">{formatTanggal(new Date())}</p>
        </div>
      </div>

      {/* Kanan */}
      <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
        <Bell size={20} className="text-gray-600" />
      </button>
    </header>
  )
}