import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatJam, getToday, getTimeNow } from '../utils/helpers'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Alert from '../components/ui/Alert'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { Receipt, Plus, Camera } from 'lucide-react'

const KATEGORI = [
  { value: 'cup', label: 'Cup', desc: 'Beli cup → tambah stok' },
  { value: 'bahan_baku', label: 'Bahan Baku', desc: 'Gula, susu, dll' },
  { value: 'operasional', label: 'Operasional', desc: 'Sabun, plastik, dll' },
  { value: 'lainnya', label: 'Lainnya', desc: 'Biaya lain' },
]

const KATEGORI_COLORS = {
  cup: 'orange',
  bahan_baku: 'blue',
  operasional: 'green',
  lainnya: 'gray',
}

export default function Pengeluaran() {
  const { profile } = useAuth()
  const [shiftAktif, setShiftAktif] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [modal, setModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    kategori: '',
    nama_barang: '',
    qty: '1',
    harga_satuan: '',
    is_cup: false,
    jumlah_cup: '',
    foto_nota: '',
    catatan: '',
  })

  const today = getToday()

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: shift }, { data: exp }] = await Promise.all([
        supabase
          .from('shifts')
          .select('*')
          .eq('user_id', profile.id)
          .eq('tanggal', today)
          .eq('status_shift', 'open')
          .maybeSingle(),
        supabase
          .from('expenses')
          .select('*')
          .eq('user_id', profile.id)
          .eq('tanggal', today)
          .order('created_at', { ascending: false }),
      ])
      setShiftAktif(shift)
      setExpenses(exp ?? [])
    } finally {
      setLoading(false)
    }
  }

  // Upload foto nota
  const handleUploadNota = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fileName = `nota/${profile.id}_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('nota-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('nota-images').getPublicUrl(fileName)

      setForm((p) => ({ ...p, foto_nota: publicUrl }))
    } catch (err) {
      setError('Gagal upload foto: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!shiftAktif) return setError('Tidak ada shift aktif')
    if (!form.kategori) return setError('Pilih kategori')
    if (!form.nama_barang) return setError('Isi nama barang')
    if (!form.harga_satuan) return setError('Isi harga satuan')
    if (form.is_cup && !form.jumlah_cup)
      return setError('Isi jumlah cup yang dibeli')

    setSubmitting(true)
    try {
      const jumlahCup = form.is_cup ? parseInt(form.jumlah_cup) : 0

      // Insert pengeluaran
      const { error: insertError } = await supabase.from('expenses').insert({
        shift_id: shiftAktif.id,
        user_id: profile.id,
        tanggal: today,
        jam: getTimeNow(),
        kategori: form.kategori,
        nama_barang: form.nama_barang,
        qty: parseInt(form.qty),
        harga_satuan: parseFloat(form.harga_satuan),
        is_cup: form.is_cup,
        jumlah_cup: jumlahCup,
        foto_nota: form.foto_nota || null,
        catatan: form.catatan || null,
      })

      if (insertError) throw insertError

      // Jika beli cup → update stok
      if (form.is_cup && jumlahCup > 0) {
        const { error: updateError } = await supabase
          .from('shifts')
          .update({
            cup_masuk: shiftAktif.cup_masuk + jumlahCup,
          })
          .eq('id', shiftAktif.id)

        if (updateError) throw updateError
      }

      const totalBelanja =
        parseInt(form.qty) * parseFloat(form.harga_satuan)
      setSuccess(
        `${form.nama_barang} (${formatRupiah(totalBelanja)}) berhasil dicatat!`
      )
      setModal(false)
      setForm({
        kategori: '',
        nama_barang: '',
        qty: '1',
        harga_satuan: '',
        is_cup: false,
        jumlah_cup: '',
        foto_nota: '',
        catatan: '',
      })
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalPengeluaran = expenses.reduce(
    (s, i) => s + i.qty * i.harga_satuan,
    0
  )

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Pengeluaran</h1>
        {shiftAktif && (
          <Button
            onClick={() => {
              setError('')
              setSuccess('')
              setModal(true)
            }}
          >
            <Plus size={16} /> Tambah
          </Button>
        )}
      </div>

      {success && <Alert type="success">{success}</Alert>}

      {/* Shift belum buka */}
      {!shiftAktif && (
        <Alert type="warning">
          Buka shift terlebih dahulu untuk mencatat pengeluaran.
        </Alert>
      )}

      {/* Total */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Total Pengeluaran Shift Ini</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {formatRupiah(totalPengeluaran)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {expenses.length} transaksi
          </p>
        </div>
      )}

      {/* List */}
      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Belum ada pengeluaran"
          description="Belum ada pengeluaran hari ini"
        />
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="bg-white rounded-xl p-4 border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-800">
                      {exp.nama_barang}
                    </p>
                    <Badge
                      label={
                        KATEGORI.find((k) => k.value === exp.kategori)?.label
                      }
                      color={KATEGORI_COLORS[exp.kategori]}
                    />
                    {exp.is_cup && (
                      <Badge
                        label={`+${exp.jumlah_cup} cup`}
                        color="orange"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {exp.qty} × {formatRupiah(exp.harga_satuan)} ·{' '}
                    {formatJam(exp.jam)}
                  </p>
                  {exp.catatan && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">
                      {exp.catatan}
                    </p>
                  )}
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold text-gray-800">
                    {formatRupiah(exp.qty * exp.harga_satuan)}
                  </p>
                  {exp.foto_nota && (
                    <a
                      href={exp.foto_nota}
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

      {/* ══════════════════════════════════════════ */}
      {/* MODAL INPUT PENGELUARAN                   */}
      {/* ══════════════════════════════════════════ */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Input Pengeluaran"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          {/* Kategori */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Kategori <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {KATEGORI.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      kategori: k.value,
                      is_cup: k.value === 'cup',
                    }))
                  }
                  className={`p-3 rounded-xl text-left border-2 transition-colors
                    ${
                      form.kategori === k.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                >
                  <p className="text-xs font-semibold text-gray-800">
                    {k.label}
                  </p>
                  <p className="text-xs text-gray-400">{k.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Nama Barang"
            value={form.nama_barang}
            onChange={(e) =>
              setForm((p) => ({ ...p, nama_barang: e.target.value }))
            }
            placeholder="Contoh: Sabun cuci, Plastik kresek"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jumlah"
              type="number"
              value={form.qty}
              onChange={(e) =>
                setForm((p) => ({ ...p, qty: e.target.value }))
              }
              placeholder="1"
              required
            />
            <Input
              label="Harga Satuan"
              type="number"
              value={form.harga_satuan}
              onChange={(e) =>
                setForm((p) => ({ ...p, harga_satuan: e.target.value }))
              }
              placeholder="15000"
              prefix="Rp"
              required
            />
          </div>

          {/* Preview total */}
          {form.qty && form.harga_satuan && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-800">
                {formatRupiah(
                  parseInt(form.qty || 0) *
                    parseFloat(form.harga_satuan || 0)
                )}
              </span>
            </div>
          )}

          {/* Checkbox pembelian cup */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_cup}
              onChange={(e) =>
                setForm((p) => ({ ...p, is_cup: e.target.checked }))
              }
              className="w-4 h-4 mt-0.5 accent-orange-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">
                Ini pembelian Cup?
              </p>
              <p className="text-xs text-gray-400">
                Centang jika membeli cup, stok akan otomatis bertambah
              </p>
            </div>
          </label>

          {form.is_cup && (
            <Input
              label="Jumlah Cup yang Dibeli"
              type="number"
              value={form.jumlah_cup}
              onChange={(e) =>
                setForm((p) => ({ ...p, jumlah_cup: e.target.value }))
              }
              placeholder="100"
              suffix="pcs"
              hint="Stok cup akan bertambah sejumlah ini"
              required
            />
          )}

          {/* Upload Nota */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Foto Nota (Opsional)
            </label>
            <label
              className={`flex items-center gap-3 border-2 border-dashed 
              rounded-xl p-4 cursor-pointer transition-colors
              ${
                form.foto_nota
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-orange-400'
              }`}
            >
              <Camera
                size={20}
                className={
                  form.foto_nota ? 'text-green-500' : 'text-gray-400'
                }
              />
              <span className="text-sm text-gray-500">
                {uploading
                  ? 'Mengupload...'
                  : form.foto_nota
                  ? '✓ Foto berhasil diupload'
                  : 'Tap untuk upload foto nota'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUploadNota}
                disabled={uploading}
              />
            </label>
          </div>

          <Input
            label="Catatan"
            value={form.catatan}
            onChange={(e) =>
              setForm((p) => ({ ...p, catatan: e.target.value }))
            }
            placeholder="Opsional"
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setModal(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}