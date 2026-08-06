import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import { formatRupiah, formatJam } from '../../utils/helpers'
import { Download, Receipt } from 'lucide-react'
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

export default function PengeluaranAdmin() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [karyawan, setKaryawan] = useState([])
  const [filter, setFilter] = useState({
    bulan: new Date().toISOString().slice(0, 7),
    user_id: '',
    kategori: '',
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

  const totalPengeluaran = data.reduce(
    (sum, e) => sum + e.qty * e.harga_satuan,
    0
  )

  // Rekap per kategori
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
            className="w-full border border-gray-300 rounded-xl px-3 py-2 
              text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Kategori
          </label>
          <select
            value={filter.kategori}
            onChange={(e) =>
              setFilter((p) => ({ ...p, kategori: e.target.value }))
            }
            className="w-full border border-gray-300 rounded-xl px-3 py-2 
              text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Semua</option>
            <option value="cup">Cup</option>
            <option value="bahan_baku">Bahan Baku</option>
            <option value="operasional">Operasional</option>
            <option value="lainnya">Lainnya</option>
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
          description="Belum ada pengeluaran untuk filter ini"
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
                  {e.foto_nota && (
                    <a
                      href={e.foto_nota}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Lihat nota
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}