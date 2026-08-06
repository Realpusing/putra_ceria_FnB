import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatJam, getToday, getTimeNow } from '../utils/helpers'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Alert from '../components/ui/Alert'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { ShoppingCart, Plus, Coffee, UtensilsCrossed, Search } from 'lucide-react'

export default function Penjualan() {
  const { profile } = useAuth()
  const [shiftAktif, setShiftAktif] = useState(null)
  const [shiftCups, setShiftCups] = useState([])
  const [menus, setMenus] = useState([])
  const [sales, setSales] = useState([])
  const [categories, setCategories] = useState([])
  const [modal, setModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterTipe, setFilterTipe] = useState('semua')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    menu_id: '',
    qty: '1',
    metode_bayar: 'cash',
    catatan: '',
  })

  const today = getToday()

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { data: shift },
        { data: mn },
        { data: sl },
        { data: cats },
      ] = await Promise.all([
        supabase
          .from('shifts')
          .select('*')
          .eq('user_id', profile.id)
          .eq('tanggal', today)
          .eq('status_shift', 'open')
          .maybeSingle(),
        supabase
          .from('menus')
          .select('*, cup_types(id, nama_cup), menu_categories(id, nama, urutan)')
          .eq('status', 'aktif')
          .order('nama_menu'),
        supabase
          .from('sales')
          .select('*, cup_types:cup_type_id(nama_cup)')
          .eq('user_id', profile.id)
          .eq('tanggal', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('menu_categories')
          .select('*')
          .eq('status', 'aktif')
          .order('urutan'),
      ])
      setShiftAktif(shift)
      setMenus(mn ?? [])
      setSales(sl ?? [])
      setCategories(cats ?? [])

      if (shift) {
        const { data: sc } = await supabase
          .from('shift_cups')
          .select('*')
          .eq('shift_id', shift.id)
        setShiftCups(sc ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedMenu = menus.find((m) => m.id === form.menu_id)
  const totalHarga = selectedMenu
    ? selectedMenu.harga_jual * parseInt(form.qty || 1)
    : 0
  const totalProfit = selectedMenu
    ? (selectedMenu.harga_jual - selectedMenu.harga_hpp) *
      parseInt(form.qty || 1)
    : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!shiftAktif) return setError('Tidak ada shift aktif')
    if (!form.menu_id) return setError('Pilih menu terlebih dahulu')

    setSubmitting(true)
    try {
      const cupUsed =
        selectedMenu.tipe === 'minuman'
          ? parseInt(form.qty) * selectedMenu.cup_dipakai
          : 0

      const { error: salesError } = await supabase.from('sales').insert({
        shift_id: shiftAktif.id,
        user_id: profile.id,
        tanggal: today,
        jam: getTimeNow(),
        tipe: selectedMenu.tipe,
        menu_id: form.menu_id,
        nama_menu: selectedMenu.nama_menu,
        harga_jual: selectedMenu.harga_jual,
        harga_hpp: selectedMenu.harga_hpp,
        cup_type_id: selectedMenu.cup_type_id,
        qty: parseInt(form.qty),
        cup_terpakai: cupUsed,
        metode_bayar: form.metode_bayar,
        catatan: form.catatan || null,
      })

      if (salesError) throw salesError

      if (selectedMenu.tipe === 'minuman' && cupUsed > 0) {
        await supabase
          .from('shifts')
          .update({ cup_terpakai: shiftAktif.cup_terpakai + cupUsed })
          .eq('id', shiftAktif.id)

        const matchCup = shiftCups.find(
          (sc) => sc.cup_type_id === selectedMenu.cup_type_id
        )
        if (matchCup) {
          await supabase
            .from('shift_cups')
            .update({ cup_terpakai: matchCup.cup_terpakai + cupUsed })
            .eq('id', matchCup.id)
        }
      }

      setSuccess(`${selectedMenu.nama_menu} x${form.qty} berhasil dicatat!`)
      setModal(false)
      setForm({ menu_id: '', qty: '1', metode_bayar: 'cash', catatan: '' })
      setSearch('')
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Group menu per kategori (SORTED BY URUTAN) ──
  const groupedMenus = useMemo(() => {
    // Filter by tipe & search
    const filtered = menus.filter((m) => {
      if (filterTipe !== 'semua' && m.tipe !== filterTipe) return false
      if (search) {
        const query = search.toLowerCase()
        const nameMatch = m.nama_menu.toLowerCase().includes(query)
        const catMatch = m.menu_categories?.nama
          ?.toLowerCase()
          .includes(query)
        if (!nameMatch && !catMatch) return false
      }
      return true
    })

    // Group minuman by category, makanan sendiri
    const minuman = filtered.filter((m) => m.tipe === 'minuman')
    const makanan = filtered.filter((m) => m.tipe === 'makanan')

    // Group minuman berdasarkan kategori (sudah sort by urutan dari fetchData)
    const grupMinuman = categories
      .map((cat) => ({
        id: cat.id,
        nama: cat.nama,
        urutan: cat.urutan,
        items: minuman.filter((m) => m.category_id === cat.id),
      }))
      .filter((g) => g.items.length > 0)

    // Minuman tanpa kategori
    const minumanNoCat = minuman.filter((m) => !m.category_id)
    if (minumanNoCat.length > 0) {
      grupMinuman.push({
        id: 'no-cat',
        nama: 'Lainnya',
        urutan: 999,
        items: minumanNoCat,
      })
    }

    return {
      minuman: grupMinuman,
      makanan,
    }
  }, [menus, categories, filterTipe, search])

  const totalOmzet = sales.reduce((s, i) => s + i.qty * i.harga_jual, 0)
  const totalHpp = sales.reduce((s, i) => s + i.qty * i.harga_hpp, 0)
  const totalProfitAll = totalOmzet - totalHpp
  const totalCup = sales.reduce((s, i) => s + i.cup_terpakai, 0)

  const salesMinuman = sales.filter((s) => s.tipe === 'minuman')
  const salesMakanan = sales.filter((s) => s.tipe === 'makanan')

  const METODE_MAP = {
    cash: { label: 'Cash', bg: 'bg-green-100 text-green-700' },
    transfer: { label: 'Transfer', bg: 'bg-blue-100 text-blue-700' },
    qris: { label: 'QRIS', bg: 'bg-purple-100 text-purple-700' },
  }

  const openModal = () => {
    setError('')
    setSuccess('')
    setFilterTipe('semua')
    setSearch('')
    setForm({ menu_id: '', qty: '1', metode_bayar: 'cash', catatan: '' })
    setModal(true)
  }

  // Cek apakah ada menu untuk ditampilkan
  const hasMenus =
    groupedMenus.minuman.length > 0 || groupedMenus.makanan.length > 0

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Penjualan</h1>
        {shiftAktif && (
          <Button onClick={openModal}>
            <Plus size={16} /> Tambah
          </Button>
        )}
      </div>

      {success && <Alert type="success">{success}</Alert>}

      {!shiftAktif && (
        <Alert type="warning">
          Buka shift terlebih dahulu untuk mencatat penjualan.
        </Alert>
      )}

      {/* Ringkasan */}
      {sales.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Omzet</p>
              <p className="text-sm font-bold text-green-600">
                {formatRupiah(totalOmzet)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Profit</p>
              <p className="text-sm font-bold text-blue-600">
                {formatRupiah(totalProfitAll)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">HPP</p>
              <p className="text-sm font-bold text-red-500">
                {formatRupiah(totalHpp)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Cup Dipakai</p>
              <p className="text-xl font-bold text-orange-500">{totalCup}</p>
            </div>
          </div>

          {/* Per tipe */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <Coffee size={14} className="text-orange-500" />
                <p className="text-xs text-gray-500">Minuman</p>
              </div>
              <p className="text-sm font-bold text-gray-800">
                {salesMinuman.length} transaksi
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <UtensilsCrossed size={14} className="text-amber-600" />
                <p className="text-xs text-gray-500">Makanan</p>
              </div>
              <p className="text-sm font-bold text-gray-800">
                {salesMakanan.length} transaksi
              </p>
            </div>
          </div>
        </>
      )}

      {/* List Penjualan */}
      {sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Belum ada penjualan"
          description="Belum ada penjualan hari ini"
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const profit = (sale.harga_jual - sale.harga_hpp) * sale.qty
            const Icon = sale.tipe === 'makanan' ? UtensilsCrossed : Coffee

            return (
              <div
                key={sale.id}
                className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${sale.tipe === 'makanan' ? 'bg-amber-100' : 'bg-orange-100'}`}
                >
                  <Icon
                    size={18}
                    className={
                      sale.tipe === 'makanan'
                        ? 'text-amber-600'
                        : 'text-orange-500'
                    }
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">
                    {sale.nama_menu}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sale.qty} pcs · {formatJam(sale.jam)}
                    {sale.cup_types?.nama_cup &&
                      ` · ${sale.cup_types.nama_cup}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${METODE_MAP[sale.metode_bayar]?.bg}`}
                    >
                      {METODE_MAP[sale.metode_bayar]?.label}
                    </span>
                    <span className="text-xs text-blue-500 font-medium">
                      +{formatRupiah(profit)} profit
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-800">
                    {formatRupiah(sale.qty * sale.harga_jual)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    HPP: {formatRupiah(sale.qty * sale.harga_hpp)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* MODAL INPUT PENJUALAN                     */}
      {/* ══════════════════════════════════════════ */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Input Penjualan"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          {/* Search Bar */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu..."
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl 
                text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Filter Tipe - Compact */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            {[
              { val: 'semua', label: 'Semua', icon: null },
              { val: 'minuman', label: 'Minuman', icon: Coffee },
              { val: 'makanan', label: 'Makanan', icon: UtensilsCrossed },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.val}
                  type="button"
                  onClick={() => setFilterTipe(tab.val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold 
                    transition-all flex items-center justify-center gap-1
                    ${
                      filterTipe === tab.val
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  {Icon && <Icon size={13} />}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Menu List - Grouped */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {!hasMenus ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
                {search
                  ? `Tidak ada menu yang cocok dengan "${search}"`
                  : 'Tidak ada menu tersedia'}
              </div>
            ) : (
              <>
                {/* MINUMAN - per kategori */}
                {(filterTipe === 'semua' || filterTipe === 'minuman') &&
                  groupedMenus.minuman.map((group) => (
                    <div key={group.id}>
                      {/* Header Kategori */}
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-1 z-10">
                        <div className="w-1 h-5 bg-orange-500 rounded-full" />
                        <h3 className="font-bold text-sm text-gray-800">
                          {group.nama}
                        </h3>
                        <span className="text-xs text-gray-400">
                          ({group.items.length})
                        </span>
                      </div>

                      {/* Grid Menu */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {group.items.map((m) => (
                          <MenuButton
                            key={m.id}
                            menu={m}
                            selected={form.menu_id === m.id}
                            onClick={() =>
                              setForm((p) => ({ ...p, menu_id: m.id }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                {/* MAKANAN */}
                {(filterTipe === 'semua' || filterTipe === 'makanan') &&
                  groupedMenus.makanan.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-1 z-10">
                        <div className="w-1 h-5 bg-amber-500 rounded-full" />
                        <h3 className="font-bold text-sm text-gray-800">
                          Makanan
                        </h3>
                        <span className="text-xs text-gray-400">
                          ({groupedMenus.makanan.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {groupedMenus.makanan.map((m) => (
                          <MenuButton
                            key={m.id}
                            menu={m}
                            selected={form.menu_id === m.id}
                            onClick={() =>
                              setForm((p) => ({ ...p, menu_id: m.id }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Qty */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Jumlah
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    qty: String(Math.max(1, parseInt(p.qty || 1) - 1)),
                  }))
                }
                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-lg hover:bg-gray-50"
              >
                -
              </button>
              <input
                type="number"
                value={form.qty}
                onChange={(e) =>
                  setForm((p) => ({ ...p, qty: e.target.value }))
                }
                className="flex-1 text-center border border-gray-300 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                min="1"
              />
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    qty: String(parseInt(p.qty || 1) + 1),
                  }))
                }
                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-lg hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Metode Bayar */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Metode Bayar
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'transfer', 'qris'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, metode_bayar: m }))
                  }
                  className={`py-2.5 rounded-xl text-xs font-semibold uppercase border-2 transition-colors
                    ${
                      form.metode_bayar === m
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-600'
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selectedMenu && (
            <div className="bg-orange-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {selectedMenu.nama_menu} × {form.qty}
                </span>
                <span className="font-bold text-orange-600">
                  {formatRupiah(totalHarga)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  HPP:{' '}
                  {formatRupiah(
                    selectedMenu.harga_hpp * parseInt(form.qty || 1)
                  )}
                </span>
                <span className="text-blue-600 font-semibold">
                  Profit: {formatRupiah(totalProfit)}
                </span>
              </div>
              {selectedMenu.tipe === 'minuman' && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Cup: {selectedMenu.cup_types?.nama_cup}</span>
                  <span>
                    {parseInt(form.qty || 1) * selectedMenu.cup_dipakai} pcs
                  </span>
                </div>
              )}
            </div>
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
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Sub Component: Menu Button ──
function MenuButton({ menu, selected, onClick }) {
  const Icon = menu.tipe === 'makanan' ? UtensilsCrossed : Coffee

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-xl text-left border-2 transition-all
        ${
          selected
            ? 'border-orange-500 bg-orange-50 shadow-sm'
            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
        }`}
    >
      <div className="flex items-start gap-1.5">
        <Icon
          size={12}
          className={`mt-0.5 flex-shrink-0 ${
            menu.tipe === 'makanan' ? 'text-amber-600' : 'text-orange-500'
          }`}
        />
        <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
          {menu.nama_menu}
        </p>
      </div>
      <p className="text-xs font-bold text-orange-600 mt-1.5">
        {formatRupiah(menu.harga_jual)}
      </p>
      {menu.tipe === 'minuman' && menu.cup_types?.nama_cup && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          {menu.cup_types.nama_cup}
        </p>
      )}
    </button>
  )
}