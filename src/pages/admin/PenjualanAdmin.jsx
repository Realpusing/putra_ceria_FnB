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
  ArrowUpDown,
} from 'lucide-react'
import { format, addDays, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const METODE_COLORS = { cash: 'green', transfer: 'blue', qris: 'purple' }

export default function PenjualanAdmin() {
  const [viewMode, setViewMode] = useState('harian') // 'harian' | 'bulanan' (Rentang Tanggal)
  const [data, setData] = useState([])
  const [rekapBulanan, setRekapBulanan] = useState([])
  const [loading, setLoading] = useState(true)
  const [karyawan, setKaryawan] = useState([])
  
  // Ambil tanggal pertama bulan ini untuk default 'startDate'
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  const [filter, setFilter] = useState({
    tanggal: todayStr,
    startDate: firstDayOfMonth, // Tanggal A
    endDate: todayStr,        // Tanggal B
    user_id: '',
  })
  
  // State baru untuk sorting: 'desc' (terbaru ke terlama) atau 'asc' (terlama ke terbaru)
  const [sortOrder, setSortOrder] = useState('desc') 

  const [modalEdit, setModalEdit] = useState(false)
  const [modalHapus, setModalHapus] = useState(false)
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

  useEffect(() => { fetchKaryawan() }, [])

  useEffect(() => {
    if (viewMode === 'harian') fetchDataHarian()
    else fetchDataBulanan()
  }, [filter, viewMode, sortOrder]) // Re-run ketika filter, viewMode, atau sortOrder berubah

  const fetchKaryawan = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, nama')
      .eq('role', 'karyawan')
      .order('nama')
    setKaryawan(data ?? [])
  }

  const fetchDataHarian = async () => {
    setLoading(true)
    let query = supabase
      .from('sales')
      .select('*, users(nama)')
      .eq('tanggal', filter.tanggal)
      .order('jam', { ascending: false })

    if (filter.user_id) query = query.eq('user_id', filter.user_id)

    const { data: sales } = await query
    setData(sales ?? [])
    setLoading(false)
  }

  // Fetch data berdasarkan Rentang Tanggal (Tanggal A ke Tanggal B)
  const fetchDataBulanan = async () => {
    setLoading(true)
    const { startDate, endDate, user_id } = filter

    let query = supabase
      .from('sales')
      .select('*, users(nama)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      // Sort database sesuai order yang dipilih
      .order('tanggal', { ascending: sortOrder === 'asc' })
      .order('jam', { ascending: false })

    if (user_id) query = query.eq('user_id', user_id)

    const { data: sales } = await query

    // Kelompokkan per tanggal
    const grouped = {}
    ;(sales ?? []).forEach((s) => {
      if (!grouped[s.tanggal]) grouped[s.tanggal] = []
      grouped[s.tanggal].push(s)
    })

    const rekap = Object.entries(grouped)
      .sort(([a], [b]) => {
        // Sorting kelompok tanggal di frontend agar sejalan dengan sortOrder
        return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      })
      .map(([tanggal, items]) => ({
        tanggal,
        items,
        omzet: items.reduce((s, i) => s + i.qty * i.harga_jual, 0),
        hpp: items.reduce((s, i) => s + i.qty * i.harga_hpp, 0),
        profit: items.reduce((s, i) => s + (i.harga_jual - i.harga_hpp) * i.qty, 0),
        totalItem: items.reduce((s, i) => s + i.qty, 0),
        totalCup: items.reduce((s, i) => s + i.cup_terpakai, 0),
      }))

    setData(sales ?? [])
    setRekapBulanan(rekap)
    setLoading(false)
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

  const goToToday = () =>
    setFilter((p) => ({ ...p, tanggal: todayStr }))

  const isToday = filter.tanggal === todayStr

  // ── EDIT ──────────────────────────────────────────────────────────────────
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
      viewMode === 'harian' ? await fetchDataHarian() : await fetchDataBulanan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── HAPUS ─────────────────────────────────────────────────────────────────
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
            .update({ cup_terpakai: Math.max(0, shift.cup_terpakai - selected.cup_terpakai) })
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
              .update({ cup_terpakai: Math.max(0, sc.cup_terpakai - selected.cup_terpakai) })
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
      viewMode === 'harian' ? await fetchDataHarian() : await fetchDataBulanan()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Kalkulasi summary ─────────────────────────────────────────────────────
  const totalOmzet = data.reduce((s, i) => s + i.qty * i.harga_jual, 0)
  const totalHpp = data.reduce((s, i) => s + i.qty * i.harga_hpp, 0)
  const totalProfit = totalOmzet - totalHpp
  const totalItem = data.reduce((s, i) => s + i.qty, 0)
  const totalCup = data.reduce((s, i) => s + i.cup_terpakai, 0)

  const getTanggalLabel = () =>
    format(new Date(filter.tanggal + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: id })

  const getBulanLabel = () => {
    const start = format(new Date(filter.startDate + 'T00:00:00'), 'dd MMM yyyy', { locale: id })
    const end = format(new Date(filter.endDate + 'T00:00:00'), 'dd MMM yyyy', { locale: id })
    return `${start} - ${end}`
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

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Penjualan')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const filename =
      viewMode === 'harian'
        ? `Penjualan_${filter.tanggal}.xlsx`
        : `Penjualan_${filter.startDate}_to_${filter.endDate}.xlsx`
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Laporan Penjualan</h1>
          <p className="text-sm text-gray-500">
            {viewMode === 'harian' ? getTanggalLabel() : getBulanLabel()}
          </p>
        </div>
        <Button onClick={exportExcel} variant="outline">
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* Toggle View Mode */}
      <div className="bg-white rounded-2xl p-1.5 border border-gray-100 flex gap-1">
        <button
          onClick={() => setViewMode('harian')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'harian'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar size={15} />
          Harian
        </button>
        <button
          onClick={() => setViewMode('bulanan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
            viewMode === 'bulanan'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 size={15} />
          Rentang Tanggal
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
        {viewMode === 'harian' ? (
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
        ) : (
          /* Grid Date Range Picker (Dari Tanggal A ke Tanggal B) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal (A)</label>
              <input
                type="date"
                value={filter.startDate}
                max={filter.endDate}
                onChange={(e) => setFilter((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal (B)</label>
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
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Karyawan</label>
            <select
              value={filter.user_id}
              onChange={(e) => setFilter((p) => ({ ...p, user_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Semua</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>

          {/* Filter tambahan untuk sorting (Hanya muncul di view mode rentang tanggal) */}
          {viewMode === 'bulanan' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urutan Tanggal</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="desc">Terbaru ke Terlama</option>
                <option value="asc">Terlama ke Terbaru</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 text-white">
        <p className="text-green-100 text-sm">
          Total Omzet {viewMode === 'harian' ? 'Hari Ini' : 'Periode Terpilih'}
        </p>
        <p className="text-3xl font-bold mt-1">{formatRupiah(totalOmzet)}</p>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-xl font-bold">{data.length}</p>
            <p className="text-green-100 text-xs">Transaksi</p>
          </div>
          <div>
            <p className="text-xl font-bold">{totalItem}</p>
            <p className="text-green-100 text-xs">Item</p>
          </div>
          <div>
            <p className="text-xl font-bold">{totalCup}</p>
            <p className="text-green-100 text-xs">Cup</p>
          </div>
          <div>
            <p className="text-sm font-bold">{formatRupiah(totalProfit)}</p>
            <p className="text-green-100 text-xs">Profit</p>
          </div>
        </div>
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

      {/* ── RENTANG TANGGAL: rekap per hari ── */}
      {viewMode === 'bulanan' && (
        <>
          {rekapBulanan.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Tidak ada data"
              description={`Belum ada penjualan pada rentang ${getBulanLabel()}`}
            />
          ) : (
            <div className="space-y-4">
              {rekapBulanan.map((hari) => (
                <div
                  key={hari.tanggal}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  {/* Header hari */}
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
                          {hari.items.length} transaksi · {hari.totalItem} item · {hari.totalCup} cup
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

                  {/* Tabel transaksi dalam hari tsb */}
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

      {/* ══════════════ MODAL EDIT ══════════════ */}
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

      {/* ══════════════ MODAL HAPUS ══════════════ */}
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
              <Button variant="secondary" onClick={() => setModalHapus(false)} className="flex-1">
                Batal
              </Button>
              <Button variant="danger" onClick={handleHapus} loading={submitting} className="flex-1">
                Ya, Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Komponen tabel penjualan ───────────────────────────────────────────────
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