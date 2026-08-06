import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import { formatRupiah, formatJam } from '../../utils/helpers'
import { Download, ShoppingCart, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function PenjualanAdmin() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [karyawan, setKaryawan] = useState([])
  const [filter, setFilter] = useState({
    bulan: new Date().toISOString().slice(0, 7),
    user_id: '',
  })

  useEffect(() => {
    fetchKaryawan()
  }, [])

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchKaryawan = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, nama')
      .eq('role', 'karyawan')
      .eq('status', 'aktif')
      .order('nama')
    setKaryawan(data ?? [])
  }

  const fetchData = async () => {
    setLoading(true)
    const [tahun, bulan] = filter.bulan.split('-')
    const startDate = `${tahun}-${bulan}-01`
    const lastDay = new Date(tahun, bulan, 0).getDate()
    const endDate = `${tahun}-${bulan}-${String(lastDay).padStart(2, '0')}`

    let query = supabase
      .from('sales')
      .select('*, users(nama)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false })
      .order('jam', { ascending: false })

    if (filter.user_id) query = query.eq('user_id', filter.user_id)

    const { data: sales } = await query
    setData(sales ?? [])
    setLoading(false)
  }

  const totalOmzet = data.reduce(
    (sum, s) => sum + s.qty * s.harga_satuan,
    0
  )
  const totalItem = data.reduce((sum, s) => sum + s.qty, 0)
  const totalCup = data.reduce((sum, s) => sum + s.cup_terpakai, 0)
  const omzetCash = data
    .filter((s) => s.metode_bayar === 'cash')
    .reduce((sum, s) => sum + s.qty * s.harga_satuan, 0)
  const omzetTransfer = data
    .filter((s) => s.metode_bayar === 'transfer')
    .reduce((sum, s) => sum + s.qty * s.harga_satuan, 0)
  const omzetQris = data
    .filter((s) => s.metode_bayar === 'qris')
    .reduce((sum, s) => sum + s.qty * s.harga_satuan, 0)

  // Rekap per menu
  const rekapMenu = {}
  data.forEach((s) => {
    if (!rekapMenu[s.nama_menu]) {
      rekapMenu[s.nama_menu] = { qty: 0, total: 0 }
    }
    rekapMenu[s.nama_menu].qty += s.qty
    rekapMenu[s.nama_menu].total += s.qty * s.harga_satuan
  })

  const menuSorted = Object.entries(rekapMenu).sort(
    ([, a], [, b]) => b.total - a.total
  )

  const getBulanLabel = () => {
    const [y, m] = filter.bulan.split('-')
    return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: id })
  }

  const exportExcel = () => {
    const rows = data.map((s) => ({
      Tanggal: s.tanggal,
      Jam: formatJam(s.jam),
      Karyawan: s.users?.nama,
      Menu: s.nama_menu,
      Qty: s.qty,
      Harga: s.harga_satuan,
      Total: s.qty * s.harga_satuan,
      Cup: s.cup_terpakai,
      Bayar: s.metode_bayar,
    }))

    const rekapRows = menuSorted.map(([menu, data]) => ({
      Menu: menu,
      'Qty Terjual': data.qty,
      'Total Omzet': data.total,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      'Detail Penjualan'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rekapRows),
      'Rekap Menu'
    )
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `Penjualan_${filter.bulan}.xlsx`
    )
  }

  const METODE_COLORS = {
    cash: 'green',
    transfer: 'blue',
    qris: 'purple',
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Laporan Penjualan
          </h1>
          <p className="text-sm text-gray-500">{getBulanLabel()}</p>
        </div>
        <Button onClick={exportExcel} variant="outline">
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Bulan
          </label>
          <input
            type="month"
            value={filter.bulan}
            onChange={(e) =>
              setFilter((p) => ({ ...p, bulan: e.target.value }))
            }
            className="w-full border border-gray-300 rounded-xl px-3 py-2 
              text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Karyawan
          </label>
          <select
            value={filter.user_id}
            onChange={(e) =>
              setFilter((p) => ({ ...p, user_id: e.target.value }))
            }
            className="w-full border border-gray-300 rounded-xl px-3 py-2 
              text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Semua</option>
            {karyawan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 text-white">
        <p className="text-green-100 text-sm">Total Omzet</p>
        <p className="text-3xl font-bold mt-1">{formatRupiah(totalOmzet)}</p>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold">{data.length}</p>
            <p className="text-green-100 text-xs">Transaksi</p>
          </div>
          <div>
            <p className="text-xl font-bold">{totalItem}</p>
            <p className="text-green-100 text-xs">Item Terjual</p>
          </div>
          <div>
            <p className="text-xl font-bold">{totalCup}</p>
            <p className="text-green-100 text-xs">Cup Terpakai</p>
          </div>
        </div>
      </div>

      {/* Per Metode Bayar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <Badge label="Cash" color="green" />
          <p className="text-sm font-bold text-gray-800 mt-2">
            {formatRupiah(omzetCash)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <Badge label="Transfer" color="blue" />
          <p className="text-sm font-bold text-gray-800 mt-2">
            {formatRupiah(omzetTransfer)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <Badge label="QRIS" color="purple" />
          <p className="text-sm font-bold text-gray-800 mt-2">
            {formatRupiah(omzetQris)}
          </p>
        </div>
      </div>

      {/* Rekap Menu */}
      {menuSorted.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="font-bold text-gray-800">Menu Terlaris</p>
          </div>
          <div className="divide-y divide-gray-50">
            {menuSorted.map(([menu, info], idx) => (
              <div
                key={menu}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 bg-orange-100 rounded-full flex 
                    items-center justify-center text-xs font-bold text-orange-500"
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{menu}</p>
                    <p className="text-xs text-gray-400">{info.qty} terjual</p>
                  </div>
                </div>
                <p className="font-bold text-sm text-gray-800">
                  {formatRupiah(info.total)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Tabel */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Detail Penjualan</p>
          <p className="text-xs text-gray-400">{data.length} transaksi</p>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Tidak ada data"
            description="Belum ada penjualan untuk filter ini"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Tanggal',
                    'Jam',
                    'Karyawan',
                    'Menu',
                    'Qty',
                    'Total',
                    'Cup',
                    'Bayar',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold 
                        text-gray-500 px-3 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-3 font-medium">{s.tanggal}</td>
                    <td className="px-3 py-3">{formatJam(s.jam)}</td>
                    <td className="px-3 py-3">{s.users?.nama}</td>
                    <td className="px-3 py-3">{s.nama_menu}</td>
                    <td className="px-3 py-3">{s.qty}</td>
                    <td className="px-3 py-3 font-semibold">
                      {formatRupiah(s.qty * s.harga_satuan)}
                    </td>
                    <td className="px-3 py-3 text-orange-500">
                      {s.cup_terpakai}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        label={s.metode_bayar}
                        color={METODE_COLORS[s.metode_bayar] || 'gray'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}