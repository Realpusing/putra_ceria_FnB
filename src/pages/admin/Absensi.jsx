import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import { getStatusBadge, formatJam, hitungDurasi } from '../../utils/helpers'
import { Download, Users, Clock } from 'lucide-react'
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

      if (filter.user_id) {
        query = query.eq('user_id', filter.user_id)
      }

      const { data: shifts } = await query
      setData(shifts ?? [])

      // Buat rekap per karyawan
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
              <div
                className="mt-3 pt-3 border-t border-gray-100 text-sm 
                flex justify-between text-gray-500"
              >
                <span>Total Jam Kerja</span>
                <span className="font-semibold text-gray-700">
                  {formatDurasiTotal(r.total_menit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabel Detail */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Detail Absensi</p>
          <p className="text-xs text-gray-400">{data.length} data</p>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Tidak ada data"
            description="Belum ada data absensi untuk bulan ini"
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}