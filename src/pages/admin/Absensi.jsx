import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'
import Input from '../../components/ui/Input'
import {
  getStatusBadge,
  formatJam,
  hitungDurasi,
} from '../../utils/helpers'
import { Download, Clock, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function Absensi() {
  const [data, setData] = useState([])
  const [rekap, setRekap] = useState([])
  const [loading, setLoading] = useState(true)
  const [karyawan, setKaryawan] = useState([])
  const [filter, setFilter] = useState({
    bulan: new Date().toISOString().slice(0, 7),
    user_id: '',
  })

  const [modalEdit, setModalEdit] = useState(false)
  const [modalHapus, setModalHapus] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState({
    jam_masuk: '',
    jam_pulang: '',
    status_hadir: 'hadir',
    keterangan_hadir: '',
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
    try {
      const [tahun, bulan] = filter.bulan.split('-')
      const startDate = `${tahun}-${bulan}-01`
      const lastDay = new Date(tahun, bulan, 0).getDate()
      const endDate = `${tahun}-${bulan}-${String(lastDay).padStart(2, '0')}`

      let query = supabase
        .from('shifts')
        .select('*, users(id, nama)')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false })
        .order('shift')

      if (filter.user_id) query = query.eq('user_id', filter.user_id)

      const { data: shifts } = await query
      setData(shifts ?? [])

      const rekapMap = {}
      shifts?.forEach((s) => {
        const uid = s.users?.id
        const nama = s.users?.nama
        if (!uid) return

        if (!rekapMap[uid]) {
          rekapMap[uid] = {
            nama,
            hadir: 0,
            telat: 0,
            izin: 0,
            sakit: 0,
            alpha: 0,
            total_shift: 0,
            total_menit: 0,
          }
        }

        rekapMap[uid][s.status_hadir] =
          (rekapMap[uid][s.status_hadir] || 0) + 1
        rekapMap[uid].total_shift++

        if (s.jam_masuk && s.jam_pulang) {
          const [jm, mm] = s.jam_masuk.split(':').map(Number)
          const [jp, mp] = s.jam_pulang.split(':').map(Number)
          rekapMap[uid].total_menit += jp * 60 + mp - (jm * 60 + mm)
        }
      })

      setRekap(Object.values(rekapMap))
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (item) => {
    setSelected(item)
    setEditForm({
      jam_masuk: item.jam_masuk || '',
      jam_pulang: item.jam_pulang || '',
      status_hadir: item.status_hadir,
      keterangan_hadir: item.keterangan_hadir || '',
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
      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          jam_masuk: editForm.jam_masuk || null,
          jam_pulang: editForm.jam_pulang || null,
          status_hadir: editForm.status_hadir,
          keterangan_hadir: editForm.keterangan_hadir || null,
          catatan: editForm.catatan || null,
        })
        .eq('id', selected.id)

      if (updateError) throw updateError

      setSuccess('Absensi berhasil diupdate')
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
      const { error: deleteError } = await supabase
        .from('shifts')
        .delete()
        .eq('id', selected.id)

      if (deleteError) throw deleteError

      setSuccess('Shift & data terkait berhasil dihapus')
      setModalHapus(false)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDurasiTotal = (menit) => {
    if (!menit || menit <= 0) return '-'
    const jam = Math.floor(menit / 60)
    const m = menit % 60
    return `${jam}j ${m}m`
  }

  const getBulanLabel = () => {
    const [y, m] = filter.bulan.split('-')
    return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: id })
  }

  const exportExcel = () => {
    const detail = data.map((s) => ({
      Tanggal: s.tanggal,
      Shift: s.shift,
      Karyawan: s.users?.nama,
      'Jam Masuk': formatJam(s.jam_masuk),
      'Jam Pulang': formatJam(s.jam_pulang),
      Durasi: hitungDurasi(s.jam_masuk, s.jam_pulang),
      Status: s.status_hadir,
      Keterangan: s.keterangan_hadir || '',
    }))

    const rekapRows = rekap.map((r) => ({
      Nama: r.nama,
      Hadir: r.hadir,
      Telat: r.telat,
      Izin: r.izin,
      Sakit: r.sakit,
      Alpha: r.alpha,
      'Total Shift': r.total_shift,
      'Total Jam': formatDurasiTotal(r.total_menit),
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(detail),
      'Detail Absensi'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rekapRows),
      'Rekap'
    )

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `Absensi_${filter.bulan}.xlsx`
    )
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Laporan Absensi</h1>
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
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
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
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Semua Karyawan</option>
            {karyawan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rekap Cards */}
      {rekap.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rekap.map((r, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-gray-100"
            >
              <p className="font-bold text-gray-800 mb-3">{r.nama}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Hadir', val: r.hadir, color: 'text-green-600' },
                  { label: 'Telat', val: r.telat, color: 'text-yellow-600' },
                  { label: 'Izin', val: r.izin, color: 'text-blue-600' },
                  { label: 'Sakit', val: r.sakit, color: 'text-purple-600' },
                  { label: 'Alpha', val: r.alpha, color: 'text-red-600' },
                  {
                    label: 'Total',
                    val: r.total_shift,
                    color: 'text-gray-600',
                  },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-2">
                    <p className={`text-xl font-bold ${color}`}>{val}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-sm flex justify-between text-gray-500">
                <span>Total Jam Kerja</span>
                <span className="font-semibold text-gray-700">
                  {formatDurasiTotal(r.total_menit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Detail Absensi</p>
          <p className="text-xs text-gray-400">{data.length} data</p>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Tidak ada data"
            description="Belum ada absensi"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Tanggal',
                    'Shift',
                    'Karyawan',
                    'Masuk',
                    'Pulang',
                    'Durasi',
                    'Status',
                    'Aksi',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold 
                        text-gray-500 px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((s) => {
                  const sb = getStatusBadge(s.status_hadir)
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{s.tanggal}</td>
                      <td className="px-4 py-3 capitalize">{s.shift}</td>
                      <td className="px-4 py-3">{s.users?.nama}</td>
                      <td className="px-4 py-3">{formatJam(s.jam_masuk)}</td>
                      <td className="px-4 py-3">{formatJam(s.jam_pulang)}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {hitungDurasi(s.jam_masuk, s.jam_pulang)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={sb.label} color={sb.color} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Pencil size={14} className="text-blue-500" />
                          </button>
                          <button
                            onClick={() => openHapus(s)}
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
        )}
      </div>

      {/* MODAL EDIT */}
      <Modal
        open={modalEdit}
        onClose={() => setModalEdit(false)}
        title="Edit Absensi"
        size="lg"
      >
        {selected && (
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Karyawan</p>
              <p className="font-semibold text-gray-800">
                {selected.users?.nama}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {selected.tanggal} · Shift {selected.shift}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Jam Masuk"
                type="time"
                value={editForm.jam_masuk}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, jam_masuk: e.target.value }))
                }
              />
              <Input
                label="Jam Pulang"
                type="time"
                value={editForm.jam_pulang}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, jam_pulang: e.target.value }))
                }
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Status Kehadiran
              </label>
              <div className="grid grid-cols-5 gap-2">
                {['hadir', 'telat', 'izin', 'sakit', 'alpha'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setEditForm((p) => ({ ...p, status_hadir: s }))
                    }
                    className={`py-2 rounded-xl text-xs font-semibold 
                      capitalize border-2 transition-colors
                      ${
                        editForm.status_hadir === s
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-gray-200 text-gray-600'
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Keterangan (Izin/Sakit/dll)"
              value={editForm.keterangan_hadir}
              onChange={(e) =>
                setEditForm((p) => ({
                  ...p,
                  keterangan_hadir: e.target.value,
                }))
              }
              placeholder="Opsional"
            />

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

      {/* MODAL HAPUS */}
      <Modal
        open={modalHapus}
        onClose={() => setModalHapus(false)}
        title="Hapus Shift?"
      >
        {selected && (
          <div className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-semibold">
                ⚠️ PERHATIAN!
              </p>
              <p className="text-xs text-red-600 mt-1">
                Menghapus shift akan menghapus <strong>semua data terkait</strong>:
              </p>
              <ul className="text-xs text-red-600 mt-1 list-disc list-inside">
                <li>Semua penjualan di shift ini</li>
                <li>Semua pengeluaran di shift ini</li>
                <li>Data stok cup shift ini</li>
              </ul>
              <p className="text-xs text-red-600 mt-2 font-semibold">
                Data yang dihapus tidak bisa dikembalikan!
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-800">
                {selected.users?.nama}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {selected.tanggal} · Shift {selected.shift}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatJam(selected.jam_masuk)} -{' '}
                {formatJam(selected.jam_pulang)}
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
                Ya, Hapus Semua
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}