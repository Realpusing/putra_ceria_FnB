import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Alert from '../../components/ui/Alert'
import { Package, Plus, Pencil, Eye, EyeOff } from 'lucide-react'

export default function CupTypes() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editData, setEditData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nama_cup: '',
    ukuran: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: cups } = await supabase
      .from('cup_types')
      .select('*')
      .order('ukuran')
    setData(cups ?? [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditData(null)
    setForm({ nama_cup: '', ukuran: '' })
    setError('')
    setSuccess('')
    setModal(true)
  }

  const openEdit = (item) => {
    setEditData(item)
    setForm({
      nama_cup: item.nama_cup,
      ukuran: item.ukuran || '',
    })
    setError('')
    setSuccess('')
    setModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.nama_cup) return setError('Nama cup wajib diisi')
    if (!form.ukuran) return setError('Ukuran wajib diisi')

    setSubmitting(true)
    try {
      const payload = {
        nama_cup: form.nama_cup,
        ukuran: form.ukuran,
      }

      if (editData) {
        const { error: err } = await supabase
          .from('cup_types')
          .update(payload)
          .eq('id', editData.id)
        if (err) throw err
        setSuccess(`${form.nama_cup} berhasil diupdate`)
      } else {
        const { error: err } = await supabase
          .from('cup_types')
          .insert({ ...payload, status: 'aktif' })
        if (err) throw err
        setSuccess(`${form.nama_cup} berhasil ditambahkan`)
      }

      setModal(false)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (item) => {
    const newStatus = item.status === 'aktif' ? 'nonaktif' : 'aktif'

    // Cek apakah cup ini masih dipakai di menu aktif
    if (newStatus === 'nonaktif') {
      const { data: menus } = await supabase
        .from('menus')
        .select('id, nama_menu')
        .eq('cup_type_id', item.id)
        .eq('status', 'aktif')

      if (menus && menus.length > 0) {
        const menuNames = menus.map((m) => m.nama_menu).join(', ')
        setSuccess('')
        setError(
          `Tidak bisa dinonaktifkan. Cup ini masih dipakai oleh menu: ${menuNames}`
        )
        return
      }
    }

    const { error } = await supabase
      .from('cup_types')
      .update({ status: newStatus })
      .eq('id', item.id)

    if (!error) {
      setError('')
      setSuccess(`${item.nama_cup} berhasil di-${newStatus}kan`)
      await fetchData()
    }
  }

  const cupAktif = data.filter((c) => c.status === 'aktif').length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Kelola Jenis Cup</h1>
          <p className="text-sm text-gray-500">
            {cupAktif} cup aktif dari {data.length} total
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Tambah Cup
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* List */}
      {data.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Belum ada jenis cup"
          description="Tambahkan jenis cup yang digunakan"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl p-5 border transition-colors ${
                item.status === 'aktif'
                  ? 'border-gray-100'
                  : 'border-gray-100 opacity-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Icon Cup */}
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Package size={20} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">
                        {item.nama_cup}
                      </p>
                      <p className="text-xs text-gray-400">
                        Ukuran: {item.ukuran || '-'}
                      </p>
                    </div>
                    <Badge
                      label={item.status}
                      color={item.status === 'aktif' ? 'green' : 'red'}
                    />
                  </div>
                </div>

                <div className="flex gap-1 ml-3">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => toggleStatus(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    title={item.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {item.status === 'aktif' ? (
                      <EyeOff size={16} className="text-red-500" />
                    ) : (
                      <Eye size={16} className="text-green-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editData ? 'Edit Jenis Cup' : 'Tambah Jenis Cup Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          <Input
            label="Nama Cup"
            value={form.nama_cup}
            onChange={(e) =>
              setForm((p) => ({ ...p, nama_cup: e.target.value }))
            }
            placeholder="Contoh: Cup 16 oz"
            required
          />

          <Input
            label="Ukuran"
            value={form.ukuran}
            onChange={(e) =>
              setForm((p) => ({ ...p, ukuran: e.target.value }))
            }
            placeholder="Contoh: 16 oz"
            required
            hint="Tulis ukuran cup (contoh: 12 oz, 14 oz, 16 oz, 22 oz)"
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
              {editData ? 'Update' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}