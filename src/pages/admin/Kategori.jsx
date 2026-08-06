import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Alert from '../../components/ui/Alert'
import { Tag, Plus, Pencil, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react'

export default function Kategori() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editData, setEditData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nama: '',
    urutan: '1',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: cats } = await supabase
      .from('menu_categories')
      .select('*')
      .order('urutan')
      .order('nama')
    setData(cats ?? [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditData(null)
    setForm({
      nama: '',
      urutan: String(data.length + 1),
    })
    setError('')
    setSuccess('')
    setModal(true)
  }

  const openEdit = (item) => {
    setEditData(item)
    setForm({
      nama: item.nama,
      urutan: String(item.urutan),
    })
    setError('')
    setSuccess('')
    setModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.nama) return setError('Nama kategori wajib diisi')

    setSubmitting(true)
    try {
      const payload = {
        nama: form.nama,
        urutan: parseInt(form.urutan) || 0,
      }

      if (editData) {
        const { error: err } = await supabase
          .from('menu_categories')
          .update(payload)
          .eq('id', editData.id)
        if (err) throw err
        setSuccess(`Kategori ${form.nama} berhasil diupdate`)
      } else {
        const { error: err } = await supabase
          .from('menu_categories')
          .insert({ ...payload, status: 'aktif' })
        if (err) throw err
        setSuccess(`Kategori ${form.nama} berhasil ditambahkan`)
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

    if (newStatus === 'nonaktif') {
      const { data: menus } = await supabase
        .from('menus')
        .select('id, nama_menu')
        .eq('category_id', item.id)
        .eq('status', 'aktif')

      if (menus && menus.length > 0) {
        setError(
          `Tidak bisa dinonaktifkan. Masih dipakai ${menus.length} menu aktif.`
        )
        return
      }
    }

    const { error } = await supabase
      .from('menu_categories')
      .update({ status: newStatus })
      .eq('id', item.id)

    if (!error) {
      setError('')
      setSuccess(`${item.nama} berhasil di-${newStatus}kan`)
      await fetchData()
    }
  }

  // Swap urutan
  const moveUp = async (item, index) => {
    if (index === 0) return
    const above = data[index - 1]

    await Promise.all([
      supabase
        .from('menu_categories')
        .update({ urutan: above.urutan })
        .eq('id', item.id),
      supabase
        .from('menu_categories')
        .update({ urutan: item.urutan })
        .eq('id', above.id),
    ])

    await fetchData()
  }

  const moveDown = async (item, index) => {
    if (index === data.length - 1) return
    const below = data[index + 1]

    await Promise.all([
      supabase
        .from('menu_categories')
        .update({ urutan: below.urutan })
        .eq('id', item.id),
      supabase
        .from('menu_categories')
        .update({ urutan: item.urutan })
        .eq('id', below.id),
    ])

    await fetchData()
  }

  const kategoriAktif = data.filter((c) => c.status === 'aktif').length

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Kelola Kategori Minuman</h1>
          <p className="text-sm text-gray-500">
            {kategoriAktif} aktif dari {data.length} total
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Tambah Kategori
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* List */}
      {data.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Belum ada kategori"
          description="Tambahkan kategori minuman"
        />
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl p-4 border transition-colors ${
                item.status === 'aktif'
                  ? 'border-gray-100'
                  : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Urutan */}
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-orange-500">
                    #{item.urutan}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-800">
                      {item.nama}
                    </p>
                    <Badge
                      label={item.status}
                      color={item.status === 'aktif' ? 'green' : 'red'}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  {/* Up */}
                  <button
                    onClick={() => moveUp(item, index)}
                    disabled={index === 0}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Naik"
                  >
                    <ArrowUp size={14} className="text-gray-500" />
                  </button>

                  {/* Down */}
                  <button
                    onClick={() => moveDown(item, index)}
                    disabled={index === data.length - 1}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Turun"
                  >
                    <ArrowDown size={14} className="text-gray-500" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Pencil size={16} className="text-gray-500" />
                  </button>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleStatus(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
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

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editData ? 'Edit Kategori' : 'Tambah Kategori Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          <Input
            label="Nama Kategori"
            value={form.nama}
            onChange={(e) =>
              setForm((p) => ({ ...p, nama: e.target.value }))
            }
            placeholder="Contoh: Teh, Coffee, Flavor-base"
            required
          />

          <Input
            label="Urutan Tampilan"
            type="number"
            value={form.urutan}
            onChange={(e) =>
              setForm((p) => ({ ...p, urutan: e.target.value }))
            }
            placeholder="1"
            hint="Semakin kecil, semakin di atas"
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