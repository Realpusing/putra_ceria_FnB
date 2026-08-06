import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  hitungCupSistemPerJenis,
  hitungSelisihPerJenis,
  formatJam,
  getToday,
  getTimeNow,
  getStatusBadge,
  hitungSelisih,
} from '../utils/helpers'
import { Clock, Package, CheckCircle, AlertCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Alert from '../components/ui/Alert'
import Loading from '../components/ui/Loading'

export default function Shift() {
  const { profile } = useAuth()
  const [shiftAktif, setShiftAktif] = useState(null)
  const [shiftCups, setShiftCups] = useState([])
  const [cupTypes, setCupTypes] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalBuka, setModalBuka] = useState(false)
  const [modalTutup, setModalTutup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const today = getToday()

  // Form buka shift
  const [formBuka, setFormBuka] = useState({
    shift: '',
    catatan: '',
    cups: {}, // { cup_type_id: jumlah }
  })

  // Form tutup shift
  const [formTutup, setFormTutup] = useState({
    catatan: '',
    cups: {}, // { cup_type_id: { cup_akhir_fisik, cup_rusak, alasan_selisih } }
  })

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Cup types
      const { data: cups } = await supabase
        .from('cup_types')
        .select('*')
        .eq('status', 'aktif')
        .order('ukuran')
      setCupTypes(cups ?? [])

      // Shift aktif
      const { data: aktif } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('tanggal', today)
        .eq('status_shift', 'open')
        .maybeSingle()
      setShiftAktif(aktif)

      // Shift cups
      if (aktif) {
        const { data: sc } = await supabase
          .from('shift_cups')
          .select('*, cup_types(nama_cup, ukuran)')
          .eq('shift_id', aktif.id)
        setShiftCups(sc ?? [])
      } else {
        setShiftCups([])
      }

      // Riwayat
      const { data: rwyt } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', profile.id)
        .order('tanggal', { ascending: false })
        .limit(10)
      setRiwayat(rwyt ?? [])
    } finally {
      setLoading(false)
    }
  }

  // ── BUKA SHIFT ──────────────────────────────────
  const handleBukaShift = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formBuka.shift) return setError('Pilih shift terlebih dahulu')

    // Cek minimal 1 cup diisi
    const hasAnyCup = Object.values(formBuka.cups).some(
      (v) => v && parseInt(v) > 0
    )
    if (!hasAnyCup) return setError('Isi minimal 1 jenis cup')

    setSubmitting(true)
    try {
      const jamMasuk = getTimeNow()
      const batas = formBuka.shift === 'pagi' ? '09:00:00' : '16:00:00'
      const statusHadir = jamMasuk <= batas ? 'hadir' : 'telat'

      // Cek duplikat
      const { data: existing } = await supabase
        .from('shifts')
        .select('id')
        .eq('user_id', profile.id)
        .eq('tanggal', today)
        .eq('shift', formBuka.shift)
        .maybeSingle()

      if (existing) {
        setError('Shift ini sudah pernah dibuka hari ini')
        setSubmitting(false)
        return
      }

      // Hitung total cup awal
      const totalCupAwal = Object.values(formBuka.cups).reduce(
        (sum, v) => sum + (parseInt(v) || 0),
        0
      )

      // Insert shift
      const { data: newShift, error: insertError } = await supabase
        .from('shifts')
        .insert({
          user_id: profile.id,
          tanggal: today,
          shift: formBuka.shift,
          jam_masuk: jamMasuk,
          status_hadir: statusHadir,
          cup_awal: totalCupAwal,
          cup_masuk: 0,
          cup_terpakai: 0,
          cup_rusak: 0,
          status_shift: 'open',
          catatan: formBuka.catatan || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Insert shift_cups per jenis
      const cupsToInsert = cupTypes
        .filter((ct) => formBuka.cups[ct.id] && parseInt(formBuka.cups[ct.id]) > 0)
        .map((ct) => ({
          shift_id: newShift.id,
          cup_type_id: ct.id,
          cup_awal: parseInt(formBuka.cups[ct.id]),
          cup_masuk: 0,
          cup_terpakai: 0,
          cup_rusak: 0,
        }))

      if (cupsToInsert.length > 0) {
        const { error: cupsError } = await supabase
          .from('shift_cups')
          .insert(cupsToInsert)
        if (cupsError) throw cupsError
      }

      setSuccess(`Shift ${formBuka.shift} berhasil dibuka! Status: ${statusHadir}`)
      setModalBuka(false)
      setFormBuka({ shift: '', catatan: '', cups: {} })
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── TUTUP SHIFT ─────────────────────────────────
  const handleTutupShift = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validasi semua cup harus diisi akhir fisik
    for (const sc of shiftCups) {
      const formCup = formTutup.cups[sc.cup_type_id]
      if (!formCup || formCup.cup_akhir_fisik === '') {
        return setError(
          `Isi stok akhir fisik untuk ${sc.cup_types?.nama_cup}`
        )
      }

      const sistem = hitungCupSistemPerJenis({
        ...sc,
        cup_rusak: parseInt(formCup?.cup_rusak || 0),
      })
      const fisik = parseInt(formCup.cup_akhir_fisik)
      const selisih = fisik - sistem

      if (selisih !== 0 && !formCup.alasan_selisih) {
        return setError(
          `Ada selisih ${selisih} pada ${sc.cup_types?.nama_cup}. Wajib isi alasan.`
        )
      }
    }

    setSubmitting(true)
    try {
      const jamPulang = getTimeNow()
      let totalRusak = 0

      // Update setiap shift_cups
      for (const sc of shiftCups) {
        const formCup = formTutup.cups[sc.cup_type_id]
        const cupRusak = parseInt(formCup?.cup_rusak || 0)
        totalRusak += cupRusak

        const { error: updateCupError } = await supabase
          .from('shift_cups')
          .update({
            cup_rusak: cupRusak,
            cup_akhir_fisik: parseInt(formCup.cup_akhir_fisik),
            alasan_selisih: formCup.alasan_selisih || null,
          })
          .eq('id', sc.id)

        if (updateCupError) throw updateCupError
      }

      // Update shift utama
      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          jam_pulang: jamPulang,
          cup_rusak: totalRusak,
          status_shift: 'closed',
          catatan: formTutup.catatan || null,
        })
        .eq('id', shiftAktif.id)

      if (updateError) throw updateError

      setSuccess('Shift berhasil ditutup!')
      setModalTutup(false)
      setFormTutup({ catatan: '', cups: {} })
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Init form tutup
  const openTutupModal = () => {
    const cupsForm = {}
    shiftCups.forEach((sc) => {
      cupsForm[sc.cup_type_id] = {
        cup_akhir_fisik: '',
        cup_rusak: '0',
        alasan_selisih: '',
      }
    })
    setFormTutup({ catatan: '', cups: cupsForm })
    setError('')
    setSuccess('')
    setModalTutup(true)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Shift</h1>

      {success && <Alert type="success">{success}</Alert>}

      {/* ── BELUM ADA SHIFT ── */}
      {!shiftAktif ? (
        <div className="card text-center py-10">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock size={32} className="text-orange-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">
            Belum Ada Shift Aktif
          </h2>
          <p className="text-gray-500 text-sm mt-2 mb-6">
            Buka shift untuk mulai mencatat
          </p>
          <Button
            onClick={() => {
              setError('')
              setSuccess('')
              setFormBuka({ shift: '', catatan: '', cups: {} })
              setModalBuka(true)
            }}
          >
            Buka Shift Sekarang
          </Button>
        </div>
      ) : (
        /* ── SHIFT AKTIF ── */
        <div className="space-y-4">
          {/* Info shift */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-orange-100 text-sm">Shift Berjalan</p>
                <p className="text-2xl font-bold capitalize">
                  Shift {shiftAktif.shift}
                </p>
              </div>
              <Badge label="Aktif" color="green" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-orange-100">Jam Masuk</p>
                <p className="font-bold text-lg">
                  {formatJam(shiftAktif.jam_masuk)}
                </p>
              </div>
              <div>
                <p className="text-orange-100">Status</p>
                <p className="font-bold text-lg capitalize">
                  {shiftAktif.status_hadir}
                </p>
              </div>
            </div>
          </div>

          {/* Stok cup per jenis */}
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package size={18} className="text-orange-500" />
              Stok Cup
            </h3>

            <div className="space-y-3">
              {shiftCups.map((sc) => {
                const sistem = hitungCupSistemPerJenis(sc)
                return (
                  <div key={sc.id} className="bg-gray-50 rounded-xl p-4">
                    <p className="font-semibold text-sm text-gray-800 mb-2">
                      {sc.cup_types?.nama_cup}
                    </p>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="text-gray-400">Awal</p>
                        <p className="text-lg font-bold text-gray-800">
                          {sc.cup_awal}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Masuk</p>
                        <p className="text-lg font-bold text-green-600">
                          +{sc.cup_masuk}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Pakai</p>
                        <p className="text-lg font-bold text-orange-600">
                          -{sc.cup_terpakai}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Sisa</p>
                        <p className="text-lg font-bold text-blue-600">
                          {sistem}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Button variant="danger" fullWidth onClick={openTutupModal}>
            Tutup Shift
          </Button>
        </div>
      )}

      {/* Riwayat */}
      {riwayat.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4">Riwayat Shift</h3>
          <div className="space-y-3">
            {riwayat.map((shift) => {
              const sb = getStatusBadge(shift.status_hadir)
              const ss = getStatusBadge(shift.status_shift)
              return (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm"
                >
                  <div>
                    <p className="font-semibold capitalize">
                      Shift {shift.shift} · {shift.tanggal}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {formatJam(shift.jam_masuk)} - {formatJam(shift.jam_pulang)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge label={sb.label} color={sb.color} />
                    <Badge label={ss.label} color={ss.color} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════ MODAL BUKA SHIFT ══════════════ */}
      <Modal
        open={modalBuka}
        onClose={() => setModalBuka(false)}
        title="Buka Shift"
        size="lg"
      >
        <form onSubmit={handleBukaShift} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          {/* Pilih Shift */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Pilih Shift <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['pagi', 'malam'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormBuka((p) => ({ ...p, shift: s }))}
                  className={`py-3 rounded-xl text-sm font-semibold capitalize 
                    border-2 transition-colors
                    ${
                      formBuka.shift === s
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-600 hover:border-orange-300'
                    }`}
                >
                  Shift {s}
                  <span className="block text-xs font-normal text-gray-400">
                    {s === 'pagi' ? '09:00 - 16:00' : '16:00 - 22:00'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Input cup per jenis */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Stok Awal Cup (hitung fisik) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {cupTypes.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      {ct.nama_cup}
                    </p>
                    <p className="text-xs text-gray-400">{ct.ukuran}</p>
                  </div>
                  <input
                    type="number"
                    value={formBuka.cups[ct.id] || ''}
                    onChange={(e) =>
                      setFormBuka((p) => ({
                        ...p,
                        cups: { ...p.cups, [ct.id]: e.target.value },
                      }))
                    }
                    placeholder="0"
                    className="w-24 text-center border border-gray-300 rounded-xl 
                      py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <Input
            label="Catatan"
            value={formBuka.catatan}
            onChange={(e) =>
              setFormBuka((p) => ({ ...p, catatan: e.target.value }))
            }
            placeholder="Opsional"
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setModalBuka(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Buka Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════ MODAL TUTUP SHIFT ══════════════ */}
      <Modal
        open={modalTutup}
        onClose={() => setModalTutup(false)}
        title="Tutup Shift"
        size="lg"
      >
        <form onSubmit={handleTutupShift} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          {/* Per jenis cup */}
          {shiftCups.map((sc) => {
            const formCup = formTutup.cups[sc.cup_type_id] || {}
            const cupRusak = parseInt(formCup.cup_rusak || 0)
            const sistem = hitungCupSistemPerJenis({
              ...sc,
              cup_rusak: cupRusak,
            })
            const fisik = formCup.cup_akhir_fisik
              ? parseInt(formCup.cup_akhir_fisik)
              : null
            const selisih = fisik !== null ? fisik - sistem : null

            return (
              <div
                key={sc.id}
                className="bg-gray-50 rounded-xl p-4 space-y-3"
              >
                <p className="font-semibold text-sm text-gray-800">
                  {sc.cup_types?.nama_cup}
                </p>

                {/* Ringkasan */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between text-blue-600">
                    <span>Awal: {sc.cup_awal}</span>
                    <span>Masuk: +{sc.cup_masuk}</span>
                    <span>Pakai: -{sc.cup_terpakai}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Cup Rusak</label>
                    <input
                      type="number"
                      value={formCup.cup_rusak || '0'}
                      onChange={(e) =>
                        setFormTutup((p) => ({
                          ...p,
                          cups: {
                            ...p.cups,
                            [sc.cup_type_id]: {
                              ...p.cups[sc.cup_type_id],
                              cup_rusak: e.target.value,
                            },
                          },
                        }))
                      }
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm 
                        focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">
                      Stok Akhir Fisik *
                    </label>
                    <input
                      type="number"
                      value={formCup.cup_akhir_fisik || ''}
                      onChange={(e) =>
                        setFormTutup((p) => ({
                          ...p,
                          cups: {
                            ...p.cups,
                            [sc.cup_type_id]: {
                              ...p.cups[sc.cup_type_id],
                              cup_akhir_fisik: e.target.value,
                            },
                          },
                        }))
                      }
                      placeholder="Hitung fisik"
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm 
                        focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>

                {/* Preview selisih */}
                {selisih !== null && (
                  <div
                    className={`rounded-lg p-2 text-xs flex items-center gap-2 ${
                      selisih === 0
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {selisih === 0 ? (
                      <CheckCircle size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    <span>
                      Sistem: {sistem} | Fisik: {fisik} |{' '}
                      {selisih === 0
                        ? 'Sesuai ✓'
                        : `Selisih: ${selisih > 0 ? '+' : ''}${selisih}`}
                    </span>
                  </div>
                )}

                {/* Alasan selisih */}
                {selisih !== null && selisih !== 0 && (
                  <input
                    value={formCup.alasan_selisih || ''}
                    onChange={(e) =>
                      setFormTutup((p) => ({
                        ...p,
                        cups: {
                          ...p.cups,
                          [sc.cup_type_id]: {
                            ...p.cups[sc.cup_type_id],
                            alasan_selisih: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="Alasan selisih (wajib)"
                    required
                    className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm 
                      focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                )}
              </div>
            )
          })}

          <Input
            label="Catatan"
            value={formTutup.catatan}
            onChange={(e) =>
              setFormTutup((p) => ({ ...p, catatan: e.target.value }))
            }
            placeholder="Opsional"
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setModalTutup(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={submitting}
              className="flex-1"
            >
              Tutup Shift
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}