import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Alert from '../../components/ui/Alert'
import { formatRupiah } from '../../utils/helpers'
import { Coffee, UtensilsCrossed, Plus, Pencil, Eye, EyeOff } from 'lucide-react'

export default function MenuPage() {
  const [data, setData] = useState([])
  const [cupTypes, setCupTypes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editData, setEditData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterTipe, setFilterTipe] = useState('semua')

  const [form, setForm] = useState({
    tipe: 'minuman',
    nama_menu: '',
    category_id: '',
    harga_hpp: '',
    harga_jual: '',
    cup_type_id: '',
    cup_dipakai: '1',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: menus }, { data: cups }, { data: cats }] = await Promise.all([
      supabase
        .from('menus')
        .select('*, cup_types(id, nama_cup, ukuran), menu_categories(id, nama)')
        .order('tipe')
        .order('nama_menu'),
      supabase
        .from('cup_types')
        .select('*')
        .eq('status', 'aktif')
        .order('urutan'),
      supabase
        .from('menu_categories')
        .select('*')
        .eq('status', 'aktif')
        .order('urutan'),
    ])
    setData(menus ?? [])
    setCupTypes(cups ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditData(null)
    setForm({
      tipe: 'minuman',
      nama_menu: '',
      category_id: '',
      harga_hpp: '',
      harga_jual: '',
      cup_type_id: cupTypes[0]?.id || '',
      cup_dipakai: '1',
    })
    setError('')
    setModal(true)
  }

  const openEdit = (item) => {
    setEditData(item)
    setForm({
      tipe: item.tipe || 'minuman',
      nama_menu: item.nama_menu,
      category_id: item.category_id || '',
      harga_hpp: String(item.harga_hpp),
      harga_jual: String(item.harga_jual),
      cup_type_id: item.cup_type_id || '',
      cup_dipakai: String(item.cup_dipakai),
    })
    setError('')
    setModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.nama_menu || !form.harga_jual) {
      return setError('Nama menu dan harga jual wajib diisi')
    }

    if (form.tipe === 'minuman') {
      if (!form.cup_type_id) return setError('Pilih jenis cup untuk minuman')
      if (!form.category_id) return setError('Pilih kategori untuk minuman')
    }

    setSubmitting(true)
    try {
      const payload = {
        tipe: form.tipe,
        nama_menu: form.nama_menu,
        category_id: form.tipe === 'minuman' ? form.category_id : null,
        harga_hpp: parseFloat(form.harga_hpp) || 0,
        harga_jual: parseFloat(form.harga_jual),
        cup_type_id: form.tipe === 'minuman' ? form.cup_type_id : null,
        cup_dipakai:
          form.tipe === 'minuman' ? parseInt(form.cup_dipakai) || 1 : 0,
      }

      if (editData) {
        const { error: err } = await supabase
          .from('menus')
          .update(payload)
          .eq('id', editData.id)
        if (err) throw err
        setSuccess(`Menu ${form.nama_menu} berhasil diupdate`)
      } else {
        const { error: err } = await supabase
          .from('menus')
          .insert({ ...payload, status: 'aktif' })
        if (err) throw err
        setSuccess(`Menu ${form.nama_menu} berhasil ditambahkan`)
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
    const { error } = await supabase
      .from('menus')
      .update({ status: newStatus })
      .eq('id', item.id)

    if (!error) {
      setSuccess(`${item.nama_menu} berhasil di-${newStatus}kan`)
      await fetchData()
    }
  }

  const filteredData =
    filterTipe === 'semua'
      ? data
      : data.filter((m) => m.tipe === filterTipe)

  const menuAktif = data.filter((m) => m.status === 'aktif').length
  const totalMinuman = data.filter((m) => m.tipe === 'minuman').length
  const totalMakanan = data.filter((m) => m.tipe === 'makanan').length

  const previewProfit =
    form.harga_jual && form.harga_hpp
      ? parseFloat(form.harga_jual) - parseFloat(form.harga_hpp)
      : null

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Kelola Menu</h1>
          <p className="text-sm text-gray-500">
            {menuAktif} aktif · {totalMinuman} minuman · {totalMakanan} makanan
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Tambah Menu
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}

      {/* Filter Tipe */}
      <div className="bg-white rounded-2xl p-1 border border-gray-100 flex gap-1">
        {[
          { val: 'semua', label: `Semua (${data.length})`, icon: null },
          {
            val: 'minuman',
            label: `Minuman (${totalMinuman})`,
            icon: Coffee,
          },
          {
            val: 'makanan',
            label: `Makanan (${totalMakanan})`,
            icon: UtensilsCrossed,
          },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.val}
              onClick={() => setFilterTipe(tab.val)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold 
                transition-colors flex items-center justify-center gap-2
                ${
                  filterTipe === tab.val
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {Icon && <Icon size={14} />}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* List - Grouped by Category (untuk minuman) */}
      {filteredData.length === 0 ? (
        <EmptyState
          icon={filterTipe === 'makanan' ? UtensilsCrossed : Coffee}
          title="Belum ada menu"
          description={`Tambahkan menu ${
            filterTipe === 'semua' ? '' : filterTipe
          } baru`}
        />
      ) : filterTipe === 'minuman' ? (
        // Group berdasarkan kategori
        <div className="space-y-4">
          {categories.map((cat) => {
            const menusInCat = filteredData.filter(
              (m) => m.category_id === cat.id
            )
            if (menusInCat.length === 0) return null

            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 bg-orange-500 rounded-full" />
                  <h3 className="font-bold text-gray-800">{cat.nama}</h3>
                  <span className="text-xs text-gray-400">
                    ({menusInCat.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {menusInCat.map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      onEdit={() => openEdit(item)}
                      onToggle={() => toggleStatus(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Tanpa kategori */}
          {(() => {
            const uncategorized = filteredData.filter((m) => !m.category_id)
            if (uncategorized.length === 0) return null
            return (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 bg-gray-300 rounded-full" />
                  <h3 className="font-bold text-gray-500">Tanpa Kategori</h3>
                  <span className="text-xs text-gray-400">
                    ({uncategorized.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {uncategorized.map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      onEdit={() => openEdit(item)}
                      onToggle={() => toggleStatus(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        // Tampilan biasa untuk semua / makanan
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredData.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onToggle={() => toggleStatus(item)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editData ? 'Edit Menu' : 'Tambah Menu Baru'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          {/* Tipe */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Tipe Menu <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, tipe: 'minuman' }))}
                className={`py-3 rounded-xl text-sm font-semibold border-2 
                  transition-colors flex items-center justify-center gap-2
                  ${
                    form.tipe === 'minuman'
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-gray-200 text-gray-600 hover:border-orange-300'
                  }`}
              >
                <Coffee size={18} />
                Minuman
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, tipe: 'makanan' }))}
                className={`py-3 rounded-xl text-sm font-semibold border-2 
                  transition-colors flex items-center justify-center gap-2
                  ${
                    form.tipe === 'makanan'
                      ? 'border-amber-500 bg-amber-50 text-amber-600'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}
              >
                <UtensilsCrossed size={18} />
                Makanan
              </button>
            </div>
          </div>

          <Input
            label="Nama Menu"
            value={form.nama_menu}
            onChange={(e) =>
              setForm((p) => ({ ...p, nama_menu: e.target.value }))
            }
            placeholder={
              form.tipe === 'minuman'
                ? 'Contoh: Es Teh Manis'
                : 'Contoh: Nasi Goreng'
            }
            required
          />

          {/* Kategori (hanya minuman) */}
          {form.tipe === 'minuman' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Kategori <span className="text-red-500">*</span>
              </label>
              {categories.length === 0 ? (
                <Alert type="warning">
                  Belum ada kategori. Tambahkan di halaman Kategori dulu.
                </Alert>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({ ...p, category_id: cat.id }))
                      }
                      className={`p-3 rounded-xl text-center border-2 transition-colors
                        ${
                          form.category_id === cat.id
                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                            : 'border-gray-200 text-gray-600 hover:border-orange-300'
                        }`}
                    >
                      <p className="text-sm font-semibold">{cat.nama}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Jenis Cup (hanya minuman) */}
          {form.tipe === 'minuman' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Jenis Cup <span className="text-red-500">*</span>
              </label>
              {cupTypes.length === 0 ? (
                <Alert type="warning">
                  Belum ada jenis cup. Tambahkan di halaman Jenis Cup dulu.
                </Alert>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {cupTypes.map((cup) => (
                    <button
                      key={cup.id}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({ ...p, cup_type_id: cup.id }))
                      }
                      className={`p-3 rounded-xl text-left border-2 transition-colors
                        ${
                          form.cup_type_id === cup.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        {cup.nama_cup}
                      </p>
                      <p className="text-xs text-gray-400">{cup.ukuran}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Harga */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Harga HPP"
              type="number"
              value={form.harga_hpp}
              onChange={(e) =>
                setForm((p) => ({ ...p, harga_hpp: e.target.value }))
              }
              placeholder="5000"
              prefix="Rp"
              hint="Harga modal"
              required
            />

            <Input
              label="Harga Jual"
              type="number"
              value={form.harga_jual}
              onChange={(e) =>
                setForm((p) => ({ ...p, harga_jual: e.target.value }))
              }
              placeholder="12000"
              prefix="Rp"
              hint="Ke customer"
              required
            />
          </div>

          {/* Preview */}
          {previewProfit !== null && (
            <div
              className={`rounded-xl p-3 text-sm flex justify-between ${
                previewProfit > 0
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              <span>Profit per porsi</span>
              <span className="font-bold">{formatRupiah(previewProfit)}</span>
            </div>
          )}

          {form.tipe === 'minuman' && (
            <Input
              label="Cup Dipakai per Porsi"
              type="number"
              value={form.cup_dipakai}
              onChange={(e) =>
                setForm((p) => ({ ...p, cup_dipakai: e.target.value }))
              }
              placeholder="1"
              suffix="cup"
              hint="Biasanya 1 cup per porsi"
            />
          )}

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

// ── Sub Component: Menu Card ──
function MenuCard({ item, onEdit, onToggle }) {
  const profit = item.harga_jual - item.harga_hpp
  const Icon = item.tipe === 'makanan' ? UtensilsCrossed : Coffee

  return (
    <div
      className={`bg-white rounded-2xl p-4 border transition-colors ${
        item.status === 'aktif'
          ? 'border-gray-100'
          : 'border-gray-100 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
            ${item.tipe === 'makanan' ? 'bg-amber-100' : 'bg-orange-100'}`}
        >
          <Icon
            size={20}
            className={
              item.tipe === 'makanan' ? 'text-amber-600' : 'text-orange-500'
            }
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-gray-800">
              {item.nama_menu}
            </p>
            <Badge
              label={item.status}
              color={item.status === 'aktif' ? 'green' : 'red'}
            />
          </div>

          {item.menu_categories?.nama && (
            <p className="text-xs text-orange-500 font-medium mt-0.5">
              {item.menu_categories.nama}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-400">HPP</p>
              <p className="text-xs font-semibold text-red-500">
                {formatRupiah(item.harga_hpp)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Jual</p>
              <p className="text-xs font-semibold text-green-600">
                {formatRupiah(item.harga_jual)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Profit</p>
              <p
                className={`text-xs font-bold ${
                  profit > 0 ? 'text-blue-600' : 'text-red-500'
                }`}
              >
                {formatRupiah(profit)}
              </p>
            </div>
          </div>

          {item.tipe === 'minuman' && (
            <p className="text-xs text-gray-400 mt-2">
              {item.cup_types?.nama_cup || '-'} · {item.cup_dipakai} cup/porsi
            </p>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Pencil size={16} className="text-gray-500" />
          </button>
          <button
            onClick={onToggle}
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
  )
}