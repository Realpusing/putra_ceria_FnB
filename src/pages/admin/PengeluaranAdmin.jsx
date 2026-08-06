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
import { Download, Receipt, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const KATEGORI_COLORS = {
  cup: 'orange',
  bahan_baku: 'blue',
  operasional: 'green',
  lainnya: 'gray',
}

const KATEGORI_LABELS = {
  cup: 'Cup',
  bahan_baku: 'Bahan Baku',
  operasional: 'Operasional',
  lainnya: 'Lainnya',
}

const KATEGORI = [
  { value: 'cup', label: 'Cup' },
  { value: 'bahan_baku', label: 'Bahan Baku' },
  { value: 'operasional', label: 'Operasional' },
  { value: 'lainnya', label: 'Lainnya' },
]

export default function PengeluaranAdmin() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [karyawan, setKaryawan] = useState([])
  const [filter, setFilter] = useState({
    bulan: new Date().toISOString().slice(0, 7),
    user_id: '',
    kategori: '',
  })

  const [modalEdit, setModalEdit] = useState(false)
  const [modalHapus, setModalHapus] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState({
    kategori: '',
    nama_barang: '',
    qty: '1',
    harga_satuan: '',
    is_cup: false,
    jumlah_cup: '',
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
      .from('expenses')
      .select('*, users(nama)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false })
      .order('jam', { ascending: false })

    if (filter.user_id) query = query.eq('user_id', filter.user_id)
    if (filter.kategori) query = query.eq('kategori', filter.kategori)

    const { data: expenses } = await query
    setData(expenses ?? [])
    setLoading(false)
  }

  const openEdit = (item) => {
    setSelected(item)
    setEditForm({
      kategori: item.kategori,
      nama_barang: item.nama_barang,
      qty: String(item.qty),
      harga_satuan: String(item.harga_satuan),
      is_cup: item.is_cup,
      jumlah_cup: String(item.jumlah_cup || ''),
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
      const newJumlahCup = editForm.is_cup ? parseInt(editForm.jumlah_cup || 0) : 0
      const oldJumlahCup = selected.is_cup ? selected.jumlah_cup : 0
      const cupDiff = newJumlahCup - oldJumlahCup

      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          kategori: editForm.kategori,
          nama_barang: editForm.nama_barang,
          qty: parseInt(editForm.qty),
          harga_satuan: parseFloat(editForm.harga_satuan),
          is_cup: editForm.is_cup,
          jumlah_cup: newJumlahCup,
          catatan: editForm.catatan || null,
        })
        .eq('id', selected.id)

      if (updateError) throw updateError

      // Update cup_masuk di shift
      if (cupDiff !== 0) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('cup_masuk')
          .eq('id', selected.shift_id)
          .single()

        if (shift) {
          await supabase
            .from('shifts')
            .update({ cup_masuk: Math.max(0, shift.cup_masuk + cupDiff) })
            .eq('id', selected.shift_id)
        }
      }

      setSuccess('Pengeluaran berhasil diupdate')
      setModalEdit(false)
      await fetchData()
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
      // Kurangi cup_masuk di shift jika ini pembelian cup
      if (selected.is_cup && selected.jumlah_cup > 0) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('cup_masuk')
          .eq('id', selected.shift_id)
          .single()

        if (shift) {
          await supabase
            .from('shifts')
            .update({
              cup_masuk: Math.max(0, shift.cup_masuk - selected.jumlah_cup),
            })
            .eq('id', selected.shift_id)
        }
      }

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', selected.id)

      if (deleteError) throw deleteError

      setSuccess('Pengeluaran berhasil dihapus')
      setModalHapus(false)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalPengeluaran = data.reduce(
    (sum, e) => sum + e.qty * e.harga_satuan,
    0
  )

  const rekapKategori = {}
  data.forEach((e) => {
    if (!rekapKategori[e.kategori]) rekapKategori[e.kategori] = 0
    rekapKategori[e.kategori] += e.qty * e.harga_satuan
  })

  const getBulanLabel = () => {
    const [y, m] = filter.bulan.split('-')
    return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: id })
  }

  const exportExcel = () => {
    const rows = data.map((e) => ({
      Tanggal: e.tanggal,
      Jam: formatJam(e.jam),
      Karyawan: e.users?.nama,
      Kategori: KATEGORI_LABELS[e.kategori],
      Barang: e.nama_barang,
      Qty: e.qty,
      'Harga Satuan': e.harga_satuan,
      Total: e.qty * e.harga_satuan,
      'Beli Cup': e.is_cup ? `${e.jumlah_cup} pcs` : '-',
      Catatan: e.catatan || '',
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      'Pengeluaran'
    )
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `Pengeluaran_${filter.bulan}.xlsx`
    )
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Laporan Pengeluaran
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
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Bulan
          </label>
          <input
            type="month"
            value={filter.bulan}
            onChange={(e) =>
              setFilter((p) => ({ ...p, bulan: e.target.value }))
            }
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Karyawan
          </label>
          <select
            value={filter.user_id}
            onChange={(e) =>
              setFilter((p) => ({ ...p, user_id: e.target.value }))
            }
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
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Kategori
          </label>
          <select
            value={filter.kategori}
            onChange={(e) =>
              setFilter((p) => ({ ...p, kategori: e.target.value }))
            }
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Semua</option>
            {KATEGORI.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <p className="text-sm text-gray-500">Total Pengeluaran</p>
        <p className="text-2xl font-bold text-red-500 mt-1">
          {formatRupiah(totalPengeluaran)}
        </p>
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(rekapKategori).map(([kat, total]) => (
            <div key={kat} className="text-center">
              <Badge
                label={KATEGORI_LABELS[kat] || kat}
                color={KATEGORI_COLORS[kat] || 'gray'}
              />
              <p className="text-sm font-bold text-gray-800 mt-1">
                {formatRupiah(total)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      {data.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Tidak ada data"
          description="Belum ada pengeluaran"
        />
      ) : (
        <div className="space-y-3">
          {data.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-2xl p-4 border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-800">
                      {e.nama_barang}
                    </p>
                    <Badge
                      label={KATEGORI_LABELS[e.kategori]}
                      color={KATEGORI_COLORS[e.kategori]}
                    />
                    {e.is_cup && (
                      <Badge label={`+${e.jumlah_cup} cup`} color="orange" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {e.users?.nama} · {e.tanggal} · {formatJam(e.jam)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {e.qty} × {formatRupiah(e.harga_satuan)}
                  </p>
                  {e.catatan && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">
                      {e.catatan}
                    </p>
                  )}
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold text-gray-800">
                    {formatRupiah(e.qty * e.harga_satuan)}
                  </p>
                  <div className="flex gap-1 mt-2 justify-end">
                    <button
                      onClick={() => openEdit(e)}
                      className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Pencil size={14} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => openHapus(e)}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL EDIT */}
      <Modal
        open={modalEdit}
        onClose={() => setModalEdit(false)}
        title="Edit Pengeluaran"
        size="lg"
      >
        {selected && (
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Kategori
              </label>
              <div className="grid grid-cols-2 gap-2">
                {KATEGORI.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() =>
                      setEditForm((p) => ({
                        ...p,
                        kategori: k.value,
                        is_cup: k.value === 'cup',
                      }))
                    }
                    className={`p-3 rounded-xl text-left border-2 transition-colors
                      ${
                        editForm.kategori === k.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                  >
                    <p className="text-xs font-semibold text-gray-800">
                      {k.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Nama Barang"
              value={editForm.nama_barang}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, nama_barang: e.target.value }))
              }
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Qty"
                type="number"
                value={editForm.qty}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, qty: e.target.value }))
                }
                required
              />
              <Input
                label="Harga Satuan"
                type="number"
                value={editForm.harga_satuan}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, harga_satuan: e.target.value }))
                }
                prefix="Rp"
                required
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.is_cup}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, is_cup: e.target.checked }))
                }
                className="w-4 h-4 mt-0.5 accent-orange-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Pembelian Cup?
                </p>
                <p className="text-xs text-gray-400">
                  Stok cup otomatis diupdate
                </p>
              </div>
            </label>

            {editForm.is_cup && (
              <Input
                label="Jumlah Cup"
                type="number"
                value={editForm.jumlah_cup}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, jumlah_cup: e.target.value }))
                }
                suffix="pcs"
                required
              />
            )}

            <Input
              label="Catatan"
              value={editForm.catatan}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, catatan: e.target.value }))
              }
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

      {/* MODAL HAPUS */}
      <Modal
        open={modalHapus}
        onClose={() => setModalHapus(false)}
        title="Hapus Pengeluaran?"
      >
        {selected && (
          <div className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-semibold">
                Yakin ingin menghapus?
              </p>
              <p className="text-xs text-red-600 mt-1">
                Data yang dihapus tidak bisa dikembalikan
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-800">
                {selected.nama_barang}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {selected.qty} × {formatRupiah(selected.harga_satuan)} ={' '}
                <span className="font-bold">
                  {formatRupiah(selected.qty * selected.harga_satuan)}
                </span>
              </p>
              {selected.is_cup && (
                <p className="text-xs text-orange-600 mt-2">
                  ⚠️ Stok cup akan dikurangi {selected.jumlah_cup} pcs
                </p>
              )}
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
