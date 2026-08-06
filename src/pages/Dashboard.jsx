import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  formatRupiah,
  formatJam,
  hitungCupSistem,
  getToday,
} from '../utils/helpers'
import {
  Coffee,
  TrendingUp,
  Package,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Receipt,
} from 'lucide-react'
import Loading from '../components/ui/Loading'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [shiftAktif, setShiftAktif] = useState(null)
  const [stats, setStats] = useState({
    totalPenjualan: 0,
    totalCupTerpakai: 0,
    totalPengeluaran: 0,
    jumlahTransaksi: 0,
  })
  const [loading, setLoading] = useState(true)

  const today = getToday()

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: shift } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('tanggal', today)
        .eq('status_shift', 'open')
        .maybeSingle()

      setShiftAktif(shift)

      if (shift) {
        const [{ data: salesData }, { data: expData }] = await Promise.all([
          supabase
            .from('sales')
            .select('qty, harga_satuan, cup_terpakai')
            .eq('shift_id', shift.id),
          supabase
            .from('expenses')
            .select('qty, harga_satuan')
            .eq('shift_id', shift.id),
        ])

        setStats({
          totalPenjualan:
            salesData?.reduce(
              (sum, item) => sum + item.qty * item.harga_satuan,
              0
            ) ?? 0,
          totalCupTerpakai:
            salesData?.reduce((sum, item) => sum + item.cup_terpakai, 0) ??
            0,
          totalPengeluaran:
            expData?.reduce(
              (sum, item) => sum + item.qty * item.harga_satuan,
              0
            ) ?? 0,
          jumlahTransaksi: salesData?.length ?? 0,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const cupSistem = shiftAktif ? hitungCupSistem(shiftAktif) : 0

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Alert belum buka shift */}
      {!shiftAktif && (
        <div
          className="bg-orange-50 border border-orange-200 rounded-2xl p-4 
          flex items-start gap-3"
        >
          <AlertTriangle
            size={20}
            className="text-orange-500 flex-shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <p className="font-semibold text-orange-700 text-sm">
              Shift belum dibuka
            </p>
            <p className="text-orange-600 text-xs mt-0.5">
              Buka shift terlebih dahulu untuk mulai mencatat.
            </p>
          </div>
          <button
            onClick={() => navigate('/shift')}
            className="bg-orange-500 text-white text-xs font-semibold 
              px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors 
              flex-shrink-0"
          >
            Buka Shift
          </button>
        </div>
      )}

      {/* Card Shift Aktif */}
      {shiftAktif && (
        <div
          className="bg-gradient-to-r from-orange-500 to-amber-500 
          rounded-2xl p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Shift Aktif</p>
              <p className="text-xl font-bold capitalize mt-0.5">
                Shift {shiftAktif.shift}
              </p>
              <p className="text-orange-100 text-sm mt-1">
                Mulai pukul {formatJam(shiftAktif.jam_masuk)}
              </p>
            </div>
            <div
              className="w-12 h-12 bg-white/20 rounded-2xl 
              flex items-center justify-center"
            >
              <Clock size={24} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{cupSistem}</p>
              <p className="text-orange-100 text-xs">Stok Cup</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {stats.totalCupTerpakai}
              </p>
              <p className="text-orange-100 text-xs">Cup Terpakai</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">
                {formatRupiah(stats.totalPenjualan)}
              </p>
              <p className="text-orange-100 text-xs">Omzet</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/shift')}
            className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white 
              text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Lihat Detail Shift
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Omzet Shift"
          value={formatRupiah(stats.totalPenjualan)}
          color="green"
          sub={`${stats.jumlahTransaksi} transaksi`}
        />
        <StatCard
          icon={Package}
          label="Cup Terpakai"
          value={`${stats.totalCupTerpakai} pcs`}
          color="blue"
        />
        <StatCard
          icon={Coffee}
          label="Stok Cup"
          value={`${cupSistem} pcs`}
          color="orange"
          sub={shiftAktif ? `Awal: ${shiftAktif.cup_awal}` : '-'}
        />
        <StatCard
          icon={Receipt}
          label="Pengeluaran"
          value={formatRupiah(stats.totalPengeluaran)}
          color="red"
        />
      </div>

      {/* Shortcut */}
      {shiftAktif && (
        <div className="grid grid-cols-2 gap-4">
          <ShortcutCard
            icon={ShoppingCart}
            iconColor="text-orange-500"
            iconBg="bg-orange-100"
            title="Input Penjualan"
            desc="Catat transaksi"
            onClick={() => navigate('/penjualan')}
          />
          <ShortcutCard
            icon={Receipt}
            iconColor="text-red-500"
            iconBg="bg-red-100"
            title="Input Pengeluaran"
            desc="Catat pengeluaran"
            onClick={() => navigate('/pengeluaran')}
          />
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
  }
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div
          className={`w-9 h-9 ${colors[color]} rounded-xl 
          flex items-center justify-center flex-shrink-0`}
        >
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function ShortcutCard({ icon: Icon, iconColor, iconBg, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-4 
        text-left hover:border-orange-300 hover:bg-orange-50 
        transition-colors"
    >
      <div
        className={`w-10 h-10 ${iconBg} rounded-xl 
        flex items-center justify-center mb-3`}
      >
        <Icon size={20} className={iconColor} />
      </div>
      <p className="font-semibold text-sm text-gray-800">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
    </button>
  )
}