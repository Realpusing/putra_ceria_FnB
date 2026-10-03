import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'
import Input from '../../components/ui/Input'
import { formatRupiah, formatJam } from '../../utils/helpers'
import {
  Download,
  ShoppingCart,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart2,
  CalendarRange,
  TrendingUp,
  Trophy,
  ChevronDown,
  ChevronUp,
  Search,
  CreditCard,
  Package,
  DollarSign,
} from 'lucide-react'
import { format, addDays, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const METODE_COLORS = { cash: 'green', transfer: 'blue', qris: 'purple' }
const METODE_HEX = { cash: '#10b981', transfer: '#3b82f6', qris: '#a855f7' }
const CHART_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6']

export default function PenjualanAdmin() {
  const [viewMode, setViewMode] = useState('harian') // 'harian' | 'bulanan' | 'rentang'
  const [data, setData] = useState([])
  const [rekapBulanan, setRekapBulanan] = useState([])
  const [loading, setLoading] = useState(true)
  const [karyawan, setKaryawan] = useState([])

  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  const [filter, setFilter] = useState({
    tanggal: todayStr,
    bulan: new Date().toISOString().slice(0, 7),
    startDate: firstDayOfMonth,
    endDate: todayStr,
    user_id: '',
    metode_bayar: '',
    tipe: '',
  })

  const [sortOrder, setSortOrder] = useState('desc')

  // Rekap menu
  const [showRekapMenu, setShowRekapMenu] = useState(false)
  const [searchMenu, setSearchMenu] = useState('')
  const [sortMenu, setSortMenu] = useState('omzet_desc')
  const [filterTipeMenu, setFilterTipeMenu] = useState('')

  // Grafik
  const [showChart, setShowChart] = useState(true)
  const [chartType, setChartType] = useState('line') // line | bar

  const [modalEdit, setModalEdit] = useState(false)
  const [modalHapus, setModalHapus] = useState(false)
  const [modalDetailMenu, setModalDetailMenu] = useState(false)
  const [selectedMenu, setSelectedMenu] = useState(null)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState({
    qty: '',
    harga_jual: '',
    harga_hpp: '',
    metode_bayar: 'cash',
    catatan: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchKaryawan()
  }, [])

  useEffect(() => {
    if (viewMode === 'harian') fetchDataHarian()
    else if (viewMode === 'bulanan') fetchDataBulanan()
    else fetchDataRentang()
  }, [filter, viewMode, sortOrder])

  const fetchKaryawan = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, nama')
      .eq('role', 'karyawan')
      .order('nama')
    setKaryawan(data ?? [])
  }

  const applyExtraFilter = (query) => {
    if (filter.user_id) query = query.eq('user_id', filter.user_id)
    if (filter.metode_bayar) query = query.eq('metode_bayar', filter.metode_bayar)
    if (filter.tipe) query = query.eq('tipe', filter.tipe)
    return query
  }

  const fetchDataHarian = async () => {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, users(nama)')
      .eq('tanggal', filter.tanggal)
      .order('jam', { ascending: false })

    query = applyExtraFilter(query)
    const { data: sales } = await query
    setData(sales ?? [])
    setLoading(false)
  }

  const fetchDataBulanan = async () => {
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
      .order('tanggal', { ascending: sortOrder === 'asc' })
      .order('jam', { ascending: false })

    query = applyExtraFilter(query)
    const { data: sales } = await query
    groupByDate(sales ?? [])
    setData(sales ?? [])
    setLoading(false)
  }

  const fetchDataRentang = async () => {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, users(nama)')
      .gte('tanggal', filter.startDate)
      .lte('tanggal', filter.endDate)
      .order('tanggal', { ascending: sortOrder === 'asc' })
      .order('jam', { ascending: false })

    query = applyExtraFilter(query)
    const { data: sales } = await query
    groupByDate(sales ?? [])
    setData(sales ?? [])
    setLoading(false)
  }

  const groupByDate = (sales) => {
    const grouped = {}
    sales.forEach((s) => {
      if (!grouped[s.tanggal]) grouped[s.tanggal] = []
      grouped[s.tanggal].push(s)
    })

    const rekap = Object.entries(grouped)
      .sort(([a], [b]) => (sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)))
      .map(([tanggal, items]) => ({
        tanggal,
        items,
        omzet: items.reduce((s, i) => s + i.qty * i.harga_jual, 0),
        hpp: items.reduce((s, i) => s + i.qty * i.harga_hpp, 0),
        profit: items.reduce((s, i) => s + (i.harga_jual - i.harga_hpp) * i.qty, 0),
        totalItem: items.reduce((s, i) => s + i.qty, 0),
        totalCup: items.reduce((s, i) => s + i.cup_terpakai, 0),
        jumlahTransaksi: items.length,
      }))

    setRekapBulanan(rekap)
  }

  // ── REKAP MENU TERLARIS ──
  const getRekapMenu = () => {
    const map = {}
    data.forEach((s) => {
      const key = `${s.nama_menu.toLowerCase().trim()}__${s.tipe}`
      if (!map[key]) {
        map[key] = {
          nama_menu: s.nama_menu,
          tipe: s.tipe,
          total_qty: 0,
          total_omzet: 0,
          total_hpp: 0,
          total_profit: 0,
          jumlah_transaksi: 0,
          total_cup: 0,
          transaksi: [],
        }
      }
      map[key].total_qty += s.qty
      map[key].total_omzet += s.qty * s.harga_jual
      map[key].total_hpp += s.qty * s.harga_hpp
      map[key].total_profit += (s.harga_jual - s.harga_hpp) * s.qty
      map[key].jumlah_transaksi += 1
      map[key].total_cup += s.cup_terpakai || 0
      map[key].transaksi.push(s)
    })

    let items = Object.values(map)

    if (filterTipeMenu) items = items.filter((i) => i.tipe === filterTipeMenu)
    if (searchMenu.trim()) {
      const q = searchMenu.toLowerCase().trim()
      items = items.filter((i) => i.nama_menu.toLowerCase().includes(q))
    }

    switch (sortMenu) {
      case 'qty_desc':
        items.sort((a, b) => b.total_qty - a.total_qty)
        break
      case 'profit_desc':
        items.sort((a, b) => b.total_profit - a.total_profit)
        break
      case 'nama_asc':
        items.sort((a, b) => a.nama_menu.localeCompare(b.nama_menu))
        break
      case 'omzet_desc':
      default:
        items.sort((a, b) => b.total_omzet - a.total_omzet)
    }

    return items
  }

  // ── DATA CHART ──
  const getChartData = () => {
    // Reverse supaya tanggal lama di kiri, baru di kanan
    return [...rekapBulanan]
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map((hari) => ({
        tanggal: format(new Date(hari.tanggal + 'T00:00:00'), 'dd/MM', { locale: id }),
        tanggalFull: hari.tanggal,
        Omzet: hari.omzet,
        Profit: hari.profit,
        HPP: hari.hpp,
        Transaksi: hari.jumlahTransaksi,
      }))
  }

  const getHourlyChartData = () => {
    // Khusus mode harian: grafik per jam
    const map = {}
    data.forEach((s) => {
      const hour = (s.jam || '00:00').slice(0, 2) + ':00'
      if (!map[hour]) map[hour] = { jam: hour, Omzet: 0, Transaksi: 0, Item: 0 }
      map[hour].Omzet += s.qty * s.harga_jual
      map[hour].Transaksi += 1
      map[hour].Item += s.qty
    })
    return Object.values(map).sort((a, b) => a.jam.localeCompare(b.jam))
  }

  const getMetodeChartData = () => {
    const map = { cash: 0, transfer: 0, qris: 0 }
    data.forEach((s) => {
      map[s.metode_bayar] = (map[s.metode_bayar] || 0) + s.qty * s.harga_jual
    })
    return Object.entries(map)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: k.toUpperCase(), value: v, color: METODE_HEX[k] }))
  }

  const goToPrevDay = () => {
    const prev = subDays(new Date(filter.tanggal), 1)
    setFilter((p) => ({ ...p, tanggal: format(prev, 'yyyy-MM-dd') }))
  }

  const goToNextDay = () => {
    const next = addDays(new Date(filter.tanggal), 1)
    if (format(next, 'yyyy-MM-dd') <= todayStr)
      setFilter((p) => ({ ...p, tanggal: format(next, 'yyyy-MM-dd') }))
  }

  const goToToday = () => setFilter((p) => ({ ...p, tanggal: todayStr }))
  const isToday = filter.tanggal === todayStr

  const setPresetRange = (days) => {
    const end = todayStr
    const start = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')
    setFilter((p) => ({ ...p, startDate: start, endDate: end }))
  }

  // ── EDIT ──
  const openEdit = (item) => {
    setSelected(item)
    setEditForm({
      qty: String(item.qty),
      harga_jual: String(item.harga_jual),
      harga_hpp: String(item.harga_hpp),
      metode_bayar: item.metode_bayar,
      catatan: item.catatan || '',
    })
    setError('')
    setSuccess('')
    setModalEdit(true)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const newQty = parseInt(editForm.qty)
      const oldQty = selected.qty
      const qtyDiff = newQty - oldQty
      const cupDiff = qtyDiff * (selected.cup_terpakai / selected.qty)

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          qty: newQty,
          harga_jual: parseFloat(editForm.harga_jual),
          harga_hpp: parseFloat(editForm.harga_hpp),
          cup_terpakai:
            selected.tipe === 'minuman'
              ? newQty * (selected.cup_terpakai / selected.qty)
              : 0,
          metode_bayar: editForm.metode_bayar,
          catatan: editForm.catatan || null,
        })
        .eq('id', selected.id)

      if (updateError) throw updateError

      if (selected.tipe === 'minuman' && cupDiff !== 0) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('cup_terpakai')
          .eq('id', selected.shift_id)
          .single()

        if (shift) {
          await supabase
            .from('shifts')
            .update({ cup_terpakai: shift.cup_terpakai + cupDiff })
            .eq('id', selected.shift_id)
        }

        if (selected.cup_type_id) {
          const { data: sc } = await supabase
            .from('shift_cups')
            .select('cup_terpakai')
            .eq('shift_id', selected.shift_id)
            .eq('cup_type_id', selected.cup_type_id)
            .maybeSingle()

          if (sc) {
            await supabase
              .from('shift_cups')
              .update({ cup_terpakai: sc.cup_terpakai + cupDiff })
              .eq('shift_id', selected.shift_id)
              .eq('cup_type_id', selected.cup_type_id)
          }
        }
      }

      setSuccess('Penjualan berhasil diupdate')
      setModalEdit(false)
      refreshData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openHapus = (item) => {
    setSelected(item)
    setError('')
    setSuccess('')
    setModalHapus(true)
  }

  const handleHapus = async () => {
    setSubmitting(true)
    try {
      if (selected.tipe === 'minuman' && selected.cup_terpakai > 0) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('cup_terpakai')
          .eq('id', selected.shift_id)
          .single()

        if (shift) {
          await supabase
            .from('shifts')
            .update({
              cup_terpakai: Math.max(0, shift.cup_terpakai - selected.cup_terpakai),
            })
            .eq('id', selected.shift_id)
        }

        if (selected.cup_type_id) {
          const { data: sc } = await supabase
            .from('shift_cups')
            .select('cup_terpakai')
            .eq('shift_id', selected.shift_id)
            .eq('cup_type_id', selected.cup_type_id)
            .maybeSingle()

          if (sc) {
            await supabase
              .from('shift_cups')
              .update({
                cup_terpakai: Math.max(0, sc.cup_terpakai - selected.cup_terpakai),
              })
              .eq('shift_id', selected.shift_id)
              .eq('cup_type_id', selected.cup_type_id)
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('id', selected.id)

      if (deleteError) throw deleteError

      setSuccess('Penjualan berhasil dihapus')
      setModalHapus(false)
      refreshData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const refreshData = () => {
    if (viewMode === 'harian') fetchDataHarian()
    else if (viewMode === 'bulanan') fetchDataBulanan()
    else fetchDataRentang()
  }

  const openDetailMenu = (menu) => {
    setSelectedMenu(menu)
    setModalDetailMenu(true)
  }

  // ── Kalkulasi summary ──
  const totalOmzet = data.reduce((s, i) => s + i.qty * i.harga_jual, 0)
  const totalHpp = data.reduce((s, i) => s + i.qty * i.harga_hpp, 0)
  const totalProfit = totalOmzet - totalHpp
  const totalItem = data.reduce((s, i) => s + i.qty, 0)
  const totalCup = data.reduce((s, i) => s + i.cup_terpakai, 0)
  const marginPercent = totalOmzet > 0 ? ((totalProfit / totalOmzet) * 100).toFixed(1) : 0
  const avgTransaksi = data.length > 0 ? totalOmzet / data.length : 0

  // Metode bayar summary
  const rekapMetode = { cash: 0, transfer: 0, qris: 0 }
  data.forEach((s) => {
    rekapMetode[s.metode_bayar] = (rekapMetode[s.metode_bayar] || 0) + s.qty * s.harga_jual
  })

  const getTanggalLabel = () =>
    format(new Date(filter.tanggal + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: id })

  const getBulanLabel = () => {
    const [y, m] = filter.bulan.split('-')
    return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: id })
  }

  const getRentangLabel = () => {
    const start = format(new Date(filter.startDate + 'T00:00:00'), 'dd MMM yyyy', { locale: id })
    const end = format(new Date(filter.endDate + 'T00:00:00'), 'dd MMM yyyy', { locale: id })
    return `${start} — ${end}`
  }

  const getPeriodeLabel = () => {
    if (viewMode === 'harian') return getTanggalLabel()
    if (viewMode === 'bulanan') return getBulanLabel()
    return getRentangLabel()
  }

  const exportExcel = () => {
    const rows = data.map((s) => ({
      Tanggal: s.tanggal,
      Jam: formatJam(s.jam),
      Karyawan: s.users?.nama,
      Tipe: s.tipe,
      Menu: s.nama_menu,
      Qty: s.qty,
      'Harga Jual': s.harga_jual,
      HPP: s.harga_hpp,
      'Total Jual': s.qty * s.harga_jual,
      'Total HPP': s.qty * s.harga_hpp,
      Profit: (s.harga_jual - s.harga_hpp) * s.qty,
      Cup: s.cup_terpakai,
      Bayar: s.metode_bayar,
    }))

    const rekapMenuData = getRekapMenu().map((m) => ({
      Menu: m.nama_menu,
      Tipe: m.tipe,
      'Total Qty': m.total_qty,
      'Total Omzet': m.total_omzet,
      'Total HPP': m.total_hpp,
      'Total Profit': m.total_profit,
      'Margin %': m.total_omzet > 0 ? ((m.total_profit / m.total_omzet) * 100).toFixed(1) : 0,
      'Jumlah Transaksi': m.jumlah_transaksi,
      'Total Cup': m.total_cup || '-',
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Penjualan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rekapMenuData), 'Rekap Menu')

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    let filename = 'Penjualan'
    if (viewMode === 'harian') filename += `_${filter.tanggal}`
    else if (viewMode === 'bulanan') filename += `_${filter.bulan}`
    else filename += `_${filter.startDate}_sd_${filter.endDate}`
    filename += '.xlsx'

    saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename)
  }

  const rekapMenuList = getRekapMenu()
  const chartData = getChartData()
  const hourlyData = getHourlyChartData()
  const metodeData = getMetodeChartData()
  const topMenu = [...rekapMenuList].sort((a, b) => b.total_qty - a.total_qty).slice(0, 5)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Laporan Penjualan</h1>
          <p className="text-sm text-gray-500">{getPeriodeLabel()}</p>
        </div>
        <Button onClick={exportExcel} variant="outline">
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}
      {error && !modalEdit && !modalHapus && <Alert type="error">{error}</Alert>}

      {/* Toggle View Mode */}
      <div className="bg-white rounded-2xl p-1.5 border border-gray-100 flex gap-1">
        <button
          onClick={() => setViewMode('harian')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'harian'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar size={14} />
          Harian
        </button>
        <button
          onClick={() => setViewMode('bulanan')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'bulanan'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 size={14} />
          Bulanan
        </button>
        <button
          onClick={() => setViewMode('rentang')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'rentang'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarRange size={14} />
          Rentang
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
        {viewMode === 'harian' && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={goToPrevDay}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2 flex-1 justify-center">
              <input
                type="date"
                value={filter.tanggal}
                max={todayStr}
                onChange={(e) => setFilter((p) => ({ ...p, tanggal: e.target.value }))}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-center"
              />
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="text-xs font-medium text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                >
                  Hari Ini
                </button>
              )}
            </div>
            <button
              onClick={goToNextDay}
              disabled={isToday}
              className={`p-2 rounded-xl transition-colors ${
                isToday ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {viewMode === 'bulanan' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bulan</label>
            <input
              type="month"
              value={filter.bulan}
              onChange={(e) => setFilter((p) => ({ ...p, bulan: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        )}

        {viewMode === 'rentang' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filter.startDate}
                  max={filter.endDate}
                  onChange={(e) => setFilter((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filter.endDate}
                  min={filter.startDate}
                  max={todayStr}
                  onChange={(e) => setFilter((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '7 Hari', days: 7 },
                { label: '14 Hari', days: 14 },
                { label: '30 Hari', days: 30 },
                { label: '60 Hari', days: 60 },
                { label: '90 Hari', days: 90 },
              ].map((p) => (
                <button
                  key={p.days}
                  onClick={() => setPresetRange(p.days)}
                  className="text-xs font-medium text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Karyawan</label>
            <select
              value={filter.user_id}
              onChange={(e) => setFilter((p) => ({ ...p, user_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Semua</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipe</label>
            <select
              value={filter.tipe}
              onChange={(e) => setFilter((p) => ({ ...p, tipe: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Semua</option>
              <option value="minuman">Minuman</option>
              <option value="makanan">Makanan</option>
              <option value="snack">Snack</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Metode Bayar</label>
            <select
              value={filter.metode_bayar}
              onChange={(e) => setFilter((p) => ({ ...p, metode_bayar: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Semua</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
          {viewMode !== 'harian' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urutan</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="desc">Terbaru dulu</option>
                <option value="asc">Terlama dulu</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<DollarSign size={18} />}
          label="Omzet"
          value={formatRupiah(totalOmzet)}
          gradient="from-green-500 to-emerald-500"
        />
        <SummaryCard
          icon={<TrendingUp size={18} />}
          label={`Profit (${marginPercent}%)`}
          value={formatRupiah(totalProfit)}
          gradient="from-blue-500 to-indigo-500"
        />
        <SummaryCard
          icon={<ShoppingCart size={18} />}
          label={`Transaksi (${totalItem} item)`}
          value={data.length}
          gradient="from-orange-500 to-red-500"
          isNumber
        />
        <SummaryCard
          icon={<Package size={18} />}
          label="Total Cup"
          value={totalCup}
          gradient="from-purple-500 to-pink-500"
          isNumber
        />
      </div>

      {/* Avg transaksi + Metode bayar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500">Rata-rata per Transaksi</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{formatRupiah(avgTransaksi)}</p>
          <p className="text-xs text-gray-400 mt-1">
            HPP: {formatRupiah(totalHpp)} · Margin: {marginPercent}%
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <CreditCard size={12} /> Metode Pembayaran
          </p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(rekapMetode).map(([k, v]) => (
              <div key={k} className="text-center">
                <Badge label={k.toUpperCase()} color={METODE_COLORS[k]} />
                <p className="text-xs font-bold text-gray-700 mt-1">{formatRupiah(v)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GRAFIK ── */}
      {data.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowChart(!showChart)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <TrendingUp size={20} className="text-orange-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">Grafik Penjualan</p>
                <p className="text-xs text-gray-400">
                  {viewMode === 'harian' ? 'Omzet per jam' : 'Trend omzet & profit harian'}
                </p>
              </div>
            </div>
            {showChart ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>

          {showChart && (
            <div className="border-t border-gray-100 p-4 space-y-4">
              {/* Toggle chart type (hanya untuk bulanan/rentang) */}
              {viewMode !== 'harian' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setChartType('line')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      chartType === 'line'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Line Chart
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      chartType === 'bar'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Bar Chart
                  </button>
                </div>
              )}

              {/* Chart utama */}
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === 'harian' ? (
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="jam" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip
                        formatter={(v, name) =>
                          name === 'Omzet' ? formatRupiah(v) : v
                        }
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Omzet" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip
                        formatter={(v) => formatRupiah(v)}
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="Omzet"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Profit"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip
                        formatter={(v) => formatRupiah(v)}
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Omzet" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Profit" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Grafik tambahan: Pie metode bayar + Top menu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                {metodeData.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Distribusi Metode Bayar
                    </p>
                    <div className="w-full h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metodeData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={70}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {metodeData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatRupiah(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {topMenu.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Top 5 Menu Terlaris
                    </p>
                    <div className="w-full h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topMenu.map((m) => ({
                            nama:
                              m.nama_menu.length > 12
                                ? m.nama_menu.slice(0, 12) + '...'
                                : m.nama_menu,
                            Terjual: m.total_qty,
                          }))}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="nama"
                            tick={{ fontSize: 11 }}
                            width={90}
                          />
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                          <Bar dataKey="Terjual" fill="#f97316" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REKAP MENU TERLARIS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowRekapMenu(!showRekapMenu)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Trophy size={20} className="text-yellow-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Rekap Menu Terlaris</p>
              <p className="text-xs text-gray-400">
                {rekapMenuList.length} jenis menu · {totalItem} total terjual
              </p>
            </div>
          </div>
          {showRekapMenu ? (
            <ChevronUp size={20} className="text-gray-400" />
          ) : (
            <ChevronDown size={20} className="text-gray-400" />
          )}
        </button>

        {showRekapMenu && (
          <div className="border-t border-gray-100">
            <div className="px-4 py-3 space-y-3 bg-gray-50 border-b border-gray-100">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Cari menu..."
                  value={searchMenu}
                  onChange={(e) => setSearchMenu(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={sortMenu}
                  onChange={(e) => setSortMenu(e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs flex-1 min-w-28"
                >
                  <option value="omzet_desc">Omzet Terbesar</option>
                  <option value="qty_desc">Terbanyak Terjual</option>
                  <option value="profit_desc">Profit Terbesar</option>
                  <option value="nama_asc">Nama A-Z</option>
                </select>
                <select
                  value={filterTipeMenu}
                  onChange={(e) => setFilterTipeMenu(e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs flex-1 min-w-28"
                >
                  <option value="">Semua Tipe</option>
                  <option value="minuman">Minuman</option>
                  <option value="makanan">Makanan</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
            </div>

            {rekapMenuList.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Tidak ada menu ditemukan</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {rekapMenuList.map((m, idx) => {
                  const margin =
                    m.total_omzet > 0 ? ((m.total_profit / m.total_omzet) * 100).toFixed(1) : 0
                  return (
                    <button
                      key={idx}
                      onClick={() => openDetailMenu(m)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {idx < 3 && (
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                              idx === 0
                                ? 'bg-yellow-500'
                                : idx === 1
                                ? 'bg-gray-400'
                                : 'bg-orange-400'
                            }`}
                          >
                            {idx + 1}
                          </div>
                        )}
                        {idx >= 3 && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500 bg-gray-100 flex-shrink-0">
                            {idx + 1}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {m.nama_menu}
                            </p>
                            <Badge label={m.tipe} color="gray" />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {m.total_qty} terjual · {m.jumlah_transaksi}× transaksi
                            {m.total_cup > 0 && ` · ${m.total_cup} cup`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-bold text-green-600">
                          {formatRupiah(m.total_omzet)}
                        </p>
                        <p className="text-xs text-blue-500">
                          Profit {formatRupiah(m.total_profit)} ({margin}%)
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── HARIAN: tabel transaksi ── */}
      {viewMode === 'harian' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="font-bold text-gray-800">Detail Penjualan</p>
            <p className="text-xs text-gray-400">{data.length} transaksi</p>
          </div>
          {data.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Tidak ada data"
              description={`Belum ada penjualan pada ${getTanggalLabel()}`}
            />
          ) : (
            <TabelPenjualan data={data} onEdit={openEdit} onHapus={openHapus} />
          )}
        </div>
      )}

      {/* ── BULANAN / RENTANG: rekap per hari ── */}
      {(viewMode === 'bulanan' || viewMode === 'rentang') && (
        <>
          {rekapBulanan.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Tidak ada data"
              description={`Belum ada penjualan pada ${getPeriodeLabel()}`}
            />
          ) : (
            <div className="space-y-4">
              {rekapBulanan.map((hari) => (
                <div
                  key={hari.tanggal}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          {format(
                            new Date(hari.tanggal + 'T00:00:00'),
                            'EEEE, dd MMMM yyyy',
                            { locale: id }
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {hari.items.length} transaksi · {hari.totalItem} item ·{' '}
                          {hari.totalCup} cup
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">
                          {formatRupiah(hari.omzet)}
                        </p>
                        <p className="text-xs text-blue-500">
                          Profit: {formatRupiah(hari.profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <TabelPenjualan
                    data={hari.items}
                    onEdit={openEdit}
                    onHapus={openHapus}
                    hideTanggal
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL EDIT */}
      <Modal open={modalEdit} onClose={() => setModalEdit(false)} title="Edit Penjualan">
        {selected && (
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Menu</p>
              <p className="font-semibold text-gray-800">{selected.nama_menu}</p>
              <p className="text-xs text-gray-400 mt-1">
                {selected.tanggal} · {formatJam(selected.jam)} · {selected.users?.nama}
              </p>
            </div>

            <Input
              label="Jumlah (Qty)"
              type="number"
              value={editForm.qty}
              onChange={(e) => setEditForm((p) => ({ ...p, qty: e.target.value }))}
              required
              min="1"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Harga Jual"
                type="number"
                value={editForm.harga_jual}
                onChange={(e) => setEditForm((p) => ({ ...p, harga_jual: e.target.value }))}
                prefix="Rp"
                required
              />
              <Input
                label="HPP"
                type="number"
                value={editForm.harga_hpp}
                onChange={(e) => setEditForm((p) => ({ ...p, harga_hpp: e.target.value }))}
                prefix="Rp"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Metode Bayar</label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'transfer', 'qris'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditForm((p) => ({ ...p, metode_bayar: m }))}
                    className={`py-2 rounded-xl text-xs font-semibold uppercase border-2 transition-colors ${
                      editForm.metode_bayar === m
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Catatan"
              value={editForm.catatan}
              onChange={(e) => setEditForm((p) => ({ ...p, catatan: e.target.value }))}
              placeholder="Opsional"
            />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setModalEdit(false)} className="flex-1">
                Batal
              </Button>
              <Button type="submit" loading={submitting} className="flex-1">
                Update
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL HAPUS */}
      <Modal open={modalHapus} onClose={() => setModalHapus(false)} title="Hapus Penjualan?">
        {selected && (
          <div className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-semibold">
                Yakin ingin menghapus penjualan ini?
              </p>
              <p className="text-xs text-red-600 mt-1">
                Data yang dihapus tidak bisa dikembalikan
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-gray-800">{selected.nama_menu}</p>
              <p className="text-sm text-gray-500">
                {selected.qty} pcs × {formatRupiah(selected.harga_jual)} ={' '}
                <span className="font-bold">
                  {formatRupiah(selected.qty * selected.harga_jual)}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {selected.tanggal} · {formatJam(selected.jam)} · {selected.users?.nama}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setModalHapus(false)}
                className="flex-1"
              >
                Batal
              </Button>
              <Button variant="danger" onClick={handleHapus} loading={submitting} className="flex-1">
                Ya, Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL DETAIL MENU */}
      <Modal
        open={modalDetailMenu}
        onClose={() => setModalDetailMenu(false)}
        title="Detail Penjualan Menu"
        size="lg"
      >
        {selectedMenu && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-bold text-gray-800">{selectedMenu.nama_menu}</p>
                <Badge label={selectedMenu.tipe} color="gray" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs text-gray-500">Total Terjual</p>
                  <p className="text-lg font-bold text-gray-800">{selectedMenu.total_qty} pcs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Omzet</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatRupiah(selectedMenu.total_omzet)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total HPP</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {formatRupiah(selectedMenu.total_hpp)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Profit</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatRupiah(selectedMenu.total_profit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Margin</p>
                  <p className="text-sm font-semibold text-purple-600">
                    {selectedMenu.total_omzet > 0
                      ? ((selectedMenu.total_profit / selectedMenu.total_omzet) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Jumlah Transaksi</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {selectedMenu.jumlah_transaksi}×
                  </p>
                </div>
                {selectedMenu.total_cup > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Total Cup Digunakan</p>
                    <p className="text-sm font-semibold text-orange-600">
                      {selectedMenu.total_cup} pcs
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Riwayat Penjualan</p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                {selectedMenu.transaksi
                  .sort((a, b) => {
                    const tgl = b.tanggal.localeCompare(a.tanggal)
                    if (tgl !== 0) return tgl
                    return (b.jam || '').localeCompare(a.jam || '')
                  })
                  .map((t, idx) => (
                    <div key={idx} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-700">
                          {format(new Date(t.tanggal + 'T00:00:00'), 'dd MMM yyyy', {
                            locale: id,
                          })}
                          <span className="text-gray-400 ml-2">{formatJam(t.jam)}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.users?.nama} ·{' '}
                          <span className="uppercase">{t.metode_bayar}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {t.qty} × {formatRupiah(t.harga_jual)}
                        </p>
                        <p className="text-sm font-bold text-gray-800">
                          {formatRupiah(t.qty * t.harga_jual)}
                        </p>
                        <p className="text-xs text-blue-500">
                          +{formatRupiah((t.harga_jual - t.harga_hpp) * t.qty)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setModalDetailMenu(false)}
              className="w-full"
            >
              Tutup
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Komponen Summary Card ──
function SummaryCard({ icon, label, value, gradient, isNumber = false }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white`}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-white/80 text-xs">{label}</p>
      <p className={`font-bold mt-0.5 ${isNumber ? 'text-xl' : 'text-base'}`}>{value}</p>
    </div>
  )
}

// ── Komponen tabel penjualan ──
function TabelPenjualan({ data, onEdit, onHapus, hideTanggal = false }) {
  const headers = [
    ...(!hideTanggal ? ['Tgl'] : []),
    'Jam',
    'Karyawan',
    'Menu',
    'Qty',
    'Total',
    'Profit',
    'Bayar',
    'Aksi',
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left text-xs font-semibold text-gray-500 px-3 py-3 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((s) => {
            const profit = (s.harga_jual - s.harga_hpp) * s.qty
            return (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                {!hideTanggal && <td className="px-3 py-3">{s.tanggal}</td>}
                <td className="px-3 py-3">{formatJam(s.jam)}</td>
                <td className="px-3 py-3">{s.users?.nama}</td>
                <td className="px-3 py-3">
                  <div>
                    <p className="font-medium">{s.nama_menu}</p>
                    <p className="text-xs text-gray-400">
                      {s.tipe}
                      {s.cup_terpakai > 0 && ` · ${s.cup_terpakai} cup`}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3">{s.qty}</td>
                <td className="px-3 py-3 font-semibold">
                  {formatRupiah(s.qty * s.harga_jual)}
                </td>
                <td className="px-3 py-3 text-blue-600 font-medium">
                  {formatRupiah(profit)}
                </td>
                <td className="px-3 py-3">
                  <Badge
                    label={s.metode_bayar}
                    color={METODE_COLORS[s.metode_bayar] || 'gray'}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(s)}
                      className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Pencil size={14} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => onHapus(s)}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}