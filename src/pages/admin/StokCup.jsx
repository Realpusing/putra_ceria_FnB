import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import { formatJam, hitungCupSistem, hitungSelisih } from '../../utils/helpers'
import { Download, Package } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function StokCup() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    bulan: new Date().toISOString().slice(0, 7),
  })

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    setLoading(true)
    const [tahun, bulan] = filter.bulan.split('-')
    const startDate = `${tahun}-${bulan}-01`
    const lastDay = new Date(tahun, bulan, 0).getDate()
    const endDate = `${tahun}-${bulan}-${String(lastDay).padStart(2, '0')}`

    const { data: shifts } = await supabase
      .from('shifts')
      .select('*, users(nama)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false })
      .order('shift')

    setData(shifts ?? [])
    setLoading(false)
  }

  const totalSelisih = data.reduce((sum, s) => {
    const selisih = hitungSelisih(s)
    return sum + (selisih || 0)
  }, 0)

  const shiftDenganSelisih = data.filter((s) => {
    const selisih = hitungSelisih(s)
    return selisih !== null && selisih !== 0
  }).length

  const exportExcel = () => {
    const rows = data.map((s) => ({
      Tanggal: s.tanggal,
      Shift: s.shift,
      Karyawan: s.users?.nama,
      'Stok Awal': s.cup_awal,
      'Cup Masuk': s.cup_masuk,
      'Cup Terpakai': s.cup_terpakai,
      'Cup Rusak': s.cup_rusak,
      'Stok Sistem': hitungCupSistem(s),
      'Stok Fisik': s.cup_akhir_fisik ?? '-',
      Selisih: hitungSelisih(s) ?? '-',
      'Alasan Selisih': s.alasan_selisih || '',
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Stok Cup')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `StokCup_${filter.bulan}.xlsx`
    )
  }

  const getBulanLabel = () => {
    const [y, m] = filter.bulan.split('-')
    return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: id })
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Laporan Stok Cup</h1>
          <p className="text-sm text-gray-500">{getBulanLabel()}</p>
        </div>
        <Button onClick={exportExcel} variant="outline">
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Bulan
        </label>
        <input
          type="month"
          value={filter.bulan}
          onChange={(e) => setFilter({ bulan: e.target.value })}
          className="w-full max-w-xs border border-gray-300 rounded-xl px-3 py-2 
            text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Total Shift</p>
          <p className="text-2xl font-bold text-gray-800">{data.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Shift Ada Selisih</p>
          <p className="text-2xl font-bold text-red-500">{shiftDenganSelisih}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Total Selisih</p>
          <p
            className={`text-2xl font-bold ${
              totalSelisih === 0
                ? 'text-green-500'
                : totalSelisih < 0
                ? 'text-red-500'
                : 'text-blue-500'
            }`}
          >
            {totalSelisih > 0 ? '+' : ''}
            {totalSelisih} cup
          </p>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">Detail Stok Per Shift</p>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Tidak ada data"
            description="Belum ada data shift untuk bulan ini"
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
                    'Awal',
                    'Masuk',
                    'Pakai',
                    'Rusak',
                    'Sistem',
                    'Fisik',
                    'Selisih',
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
                  const sistem = hitungCupSistem(s)
                  const selisih = hitungSelisih(s)

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selisih !== null && selisih !== 0 ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-medium">{s.tanggal}</td>
                      <td className="px-3 py-3 capitalize">{s.shift}</td>
                      <td className="px-3 py-3">{s.users?.nama}</td>
                      <td className="px-3 py-3">{s.cup_awal}</td>
                      <td className="px-3 py-3 text-green-600">
                        +{s.cup_masuk}
                      </td>
                      <td className="px-3 py-3 text-orange-600">
                        -{s.cup_terpakai}
                      </td>
                      <td className="px-3 py-3 text-red-600">
                        -{s.cup_rusak}
                      </td>
                      <td className="px-3 py-3 font-semibold">{sistem}</td>
                      <td className="px-3 py-3">
                        {s.cup_akhir_fisik ?? '-'}
                      </td>
                      <td className="px-3 py-3">
                        {selisih === null ? (
                          <span className="text-gray-300">-</span>
                        ) : selisih === 0 ? (
                          <Badge label="OK" color="green" />
                        ) : (
                          <Badge
                            label={`${selisih > 0 ? '+' : ''}${selisih}`}
                            color="red"
                          />
                        )}
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