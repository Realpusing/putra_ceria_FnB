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
import { Download, ShoppingCart, Pencil, Trash2 } from 'lucide-react'
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

  // Modal Edit
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

  // ── EDIT ─────────────────────────────
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

      // Update sales
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

      // Update cup di shift jika minuman
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

        // Update shift_cups juga
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
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── HAPUS ────────────────────────────
  const openHapus = (item) => {
    setSelected(item)
    setError('')
    setSuccess('')
    setModalHapus(true)
  }

  const handleHapus = async () => {
    setSubmitting(true)
    try {
      // Kurangi cup dari shift jika minuman
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
              cup_terpakai: Math.max(
                0,
                shift.cup_terpakai - selected.cup_terpakai
              ),
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
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Kalkulasi ────────────────────────
  const totalOmzet = data.reduce((s, i) => s + i.qty * i.harga_jual, 0)
  const totalHpp = data.reduce((s, i) => s + i.qty * i.harga_hpp, 0)
  const totalProfit = totalOmzet - totalHpp
  const totalItem = data.reduce((s, i) => s + i.qty, 0)
  const totalCup = data.reduce((s, i) => s + i.cup_terpakai, 0)

  const getBulanLabel = () => {
    const [y, m] = filter.bulan.split('-')
    return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: id })
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
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      'Penjualan'
    )
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `Penjualan_${filter.bulan}.xlsx`
    )
  }

  const METODE_COLORS = { cash: 'green', transfer: 'blue', qris: 'purple' }

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

      {success && <Alert type="success">{success}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

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

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Detail Penjualan</p>
          <p className="text-xs text-gray-400">{data.length} transaksi</p>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Tidak ada data"
            description="Belum ada penjualan"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Tgl',
                    'Jam',
                    'Karyawan',
                    'Menu',
                    'Qty',
                    'Total',
                    'Profit',
                    'Bayar',
                    'Aksi',
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
                {data.map((s) => {
                  const profit = (s.harga_jual - s.harga_hpp) * s.qty
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-3">{s.tanggal}</td>
                      <td className="px-3 py-3">{formatJam(s.jam)}</td>
                      <td className="px-3 py-3">{s.users?.nama}</td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium">{s.nama_menu}</p>
                          <p className="text-xs text-gray-400">
                            {s.tipe}
                            {s.cup_terpakai > 0 &&
                              ` · ${s.cup_terpakai} cup`}
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
                            onClick={() => openEdit(s)}
                            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} className="text-blue-500" />
                          </button>
                          <button
                            onClick={() => openHapus(s)}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                            title="Hapus"
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
        )}
      </div>

      {/* ══════════════ MODAL EDIT ══════════════ */}
      <Modal
        open={modalEdit}
        onClose={() => setModalEdit(false)}
        title="Edit Penjualan"
      >
        {selected && (
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Menu</p>
              <p className="font-semibold text-gray-800">
                {selected.nama_menu}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {selected.tanggal} · {formatJam(selected.jam)} ·{' '}
                {selected.users?.nama}
              </p>
            </div>

            <Input
              label="Jumlah (Qty)"
              type="number"
              value={editForm.qty}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, qty: e.target.value }))
              }
              required
              min="1"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Harga Jual"
                type="number"
                value={editForm.harga_jual}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, harga_jual: e.target.value }))
                }
                prefix="Rp"
                required
              />
              <Input
                label="HPP"
                type="number"
                value={editForm.harga_hpp}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, harga_hpp: e.target.value }))
                }
                prefix="Rp"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Metode Bayar
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'transfer', 'qris'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setEditForm((p) => ({ ...p, metode_bayar: m }))
                    }
                    className={`py-2 rounded-xl text-xs font-semibold uppercase 
                      border-2 transition-colors
                      ${
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
              onChange={(e) =>
                setEditForm((p) => ({ ...p, catatan: e.target.value }))
              }
              placeholder="Opsional"
            />

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setModalEdit(false)}
                className="flex-1"
              >
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
      <Modal
        open={modalHapus}
        onClose={() => setModalHapus(false)}
        title="Hapus Penjualan?"
      >
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
              <p className="font-semibold text-gray-800">
                {selected.nama_menu}
              </p>
              <p className="text-sm text-gray-500">
                {selected.qty} pcs × {formatRupiah(selected.harga_jual)} ={' '}
                <span className="font-bold">
                  {formatRupiah(selected.qty * selected.harga_jual)}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {selected.tanggal} · {formatJam(selected.jam)} ·{' '}
                {selected.users?.nama}
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
              <Button
                variant="danger"
                onClick={handleHapus}
                loading={submitting}
                className="flex-1"
              >
                Ya, Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}