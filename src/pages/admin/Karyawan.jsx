import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import EmptyState from '../../components/ui/EmptyState'
import Alert from '../../components/ui/Alert'
import {
  Users,
  Plus,
  Pencil,
  UserX,
  UserCheck,
  Key,
} from 'lucide-react'

export default function Karyawan() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalPassword, setModalPassword] = useState(false)
  const [editData, setEditData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nama: '',
    username: '',
    password: '',
    email: '',
    role: 'karyawan',
    shift_default: 'pagi',
    no_hp: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    userId: null,
    userName: '',
    userEmail: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .order('role')
      .order('nama')

    setData(users ?? [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditData(null)
    setForm({
      nama: '',
      username: '',
      password: '',
      email: '',
      role: 'karyawan',
      shift_default: 'pagi',
      no_hp: '',
    })
    setError('')
    setSuccess('')
    setModal(true)
  }

  const openEdit = (item) => {
    setEditData(item)
    setForm({
      nama: item.nama,
      username: item.username,
      password: '',
      email: item.email || `${item.username}@shiftsystem.local`,
      role: item.role,
      shift_default: item.shift_default || 'pagi',
      no_hp: item.no_hp || '',
    })
    setError('')
    setSuccess('')
    setModal(true)
  }

  const openChangePassword = (item) => {
    setPasswordForm({
      userId: item.id,
      userName: item.nama,
      userEmail: item.email || `${item.username}@shiftsystem.local`,
      newPassword: '',
      confirmPassword: '',
    })
    setError('')
    setSuccess('')
    setModalPassword(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.nama || !form.username) {
      return setError('Nama dan username wajib diisi')
    }

    if (!editData && !form.password) {
      return setError('Password wajib diisi untuk user baru')
    }

    if (form.password && form.password.length < 6) {
      return setError('Password minimal 6 karakter')
    }

    // Validasi username: hanya huruf, angka, underscore
    if (!/^[a-z0-9_]+$/i.test(form.username)) {
      return setError('Username hanya boleh huruf, angka, dan underscore')
    }

    setSubmitting(true)
    try {
      if (editData) {
        // ── UPDATE User ──

        // Jika username berubah, update via RPC
        if (form.username.toLowerCase() !== editData.username) {
          const { error: usernameError } = await supabase.rpc(
            'update_user_username',
            {
              user_id_input: editData.id,
              new_username: form.username.toLowerCase(),
            }
          )
          if (usernameError) throw usernameError
        }

        // Update data lain
        const { error: updateError } = await supabase
          .from('users')
          .update({
            nama: form.nama,
            no_hp: form.no_hp || null,
            role: form.role,
            shift_default:
              form.role === 'admin' ? null : form.shift_default,
          })
          .eq('id', editData.id)

        if (updateError) throw updateError
        setSuccess(`Data ${form.nama} berhasil diupdate`)
      } else {
        // ── CREATE User Baru ──
        const emailToUse = `${form.username.toLowerCase()}@shiftsystem.local`

        // 1. Buat auth user
        const { data: authData, error: authError } =
          await supabase.auth.signUp({
            email: emailToUse,
            password: form.password,
          })

        if (authError) throw authError

        const authId = authData?.user?.id
        if (!authId) throw new Error('Gagal membuat auth user')

        // 2. Insert ke tabel users
        const { error: insertError } = await supabase.from('users').insert({
          auth_id: authId,
          nama: form.nama,
          username: form.username.toLowerCase(),
          email: emailToUse,
          no_hp: form.no_hp || null,
          role: form.role,
          shift_default: form.role === 'admin' ? null : form.shift_default,
          status: 'aktif',
        })

        if (insertError) throw insertError
        setSuccess(`User ${form.nama} berhasil ditambahkan`)
      }

      setModal(false)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!passwordForm.newPassword) {
      return setError('Password baru wajib diisi')
    }

    if (passwordForm.newPassword.length < 6) {
      return setError('Password minimal 6 karakter')
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setError('Konfirmasi password tidak cocok')
    }

    setSubmitting(true)
    try {
      const { error: rpcError } = await supabase.rpc('update_user_password', {
        user_email: passwordForm.userEmail,
        new_password: passwordForm.newPassword,
      })

      if (rpcError) throw rpcError

      setSuccess(`Password ${passwordForm.userName} berhasil diubah`)
      setModalPassword(false)
      setPasswordForm({
        userId: null,
        userName: '',
        userEmail: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err) {
      setError(`Gagal ubah password: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (item) => {
    const newStatus = item.status === 'aktif' ? 'nonaktif' : 'aktif'
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', item.id)

    if (!error) {
      setSuccess(`${item.nama} berhasil di-${newStatus}kan`)
      await fetchData()
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Kelola Karyawan</h1>
          <p className="text-sm text-gray-500">{data.length} user terdaftar</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Tambah User
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* List */}
      {data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada user"
          description="Tambahkan karyawan baru"
        />
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 border border-gray-100"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg
                    ${item.role === 'admin' ? 'bg-orange-500' : 'bg-blue-500'}`}
                >
                  {item.nama.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-800">
                      {item.nama}
                    </p>
                    <Badge
                      label={item.role}
                      color={item.role === 'admin' ? 'orange' : 'blue'}
                    />
                    <Badge
                      label={item.status}
                      color={item.status === 'aktif' ? 'green' : 'red'}
                    />
                  </div>

                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-gray-500">
                      <span className="text-gray-400">Username:</span> @
                      {item.username}
                      {item.shift_default &&
                        ` · Shift ${item.shift_default}`}
                    </p>
                    {item.email && (
                      <p className="text-xs text-gray-500">
                        <span className="text-gray-400">Email:</span>{' '}
                        {item.email}
                      </p>
                    )}
                    {item.no_hp && (
                      <p className="text-xs text-gray-500">
                        <span className="text-gray-400">HP:</span> {item.no_hp}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Edit data"
                  >
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => openChangePassword(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Ubah password"
                  >
                    <Key size={16} className="text-orange-500" />
                  </button>
                  <button
                    onClick={() => toggleStatus(item)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    title={
                      item.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'
                    }
                  >
                    {item.status === 'aktif' ? (
                      <UserX size={16} className="text-red-500" />
                    ) : (
                      <UserCheck size={16} className="text-green-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* MODAL TAMBAH / EDIT USER                  */}
      {/* ══════════════════════════════════════════ */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editData ? 'Edit User' : 'Tambah User Baru'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          <Input
            label="Nama Lengkap"
            value={form.nama}
            onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
            placeholder="Contoh: Andi Saputra"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Username"
              value={form.username}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  username: e.target.value.toLowerCase(),
                }))
              }
              placeholder="andi"
              required
              hint={
                editData
                  ? '⚠️ Ubah username akan mengubah email login juga'
                  : 'Hanya huruf, angka, underscore'
              }
            />

            <Input
              label="Email (Opsional)"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="andi@email.com"
              hint="Untuk kontak, bukan untuk login"
              disabled={!!editData}
            />
          </div>

          {!editData && (
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="Min 6 karakter"
              required
              hint="Password bisa diubah kapan saja lewat tombol khusus"
            />
          )}

          <Input
            label="No. HP"
            value={form.no_hp}
            onChange={(e) => setForm((p) => ({ ...p, no_hp: e.target.value }))}
            placeholder="08xxxxxxxxxx"
          />

          {/* Role */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['karyawan', 'admin'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, role: r }))}
                  className={`py-2.5 rounded-xl text-sm font-semibold 
                    capitalize border-2 transition-colors
                    ${
                      form.role === r
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-600 hover:border-orange-300'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Shift */}
          {form.role === 'karyawan' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Shift Default
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['pagi', 'malam'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, shift_default: s }))
                    }
                    className={`py-2.5 rounded-xl text-sm font-semibold 
                      capitalize border-2 transition-colors
                      ${
                        form.shift_default === s
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

      {/* ══════════════════════════════════════════ */}
      {/* MODAL UBAH PASSWORD                       */}
      {/* ══════════════════════════════════════════ */}
      <Modal
        open={modalPassword}
        onClose={() => setModalPassword(false)}
        title="Ubah Password"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          <div className="bg-orange-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Key size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">
                {passwordForm.userName}
              </p>
              <p className="text-xs text-gray-500">
                {passwordForm.userEmail}
              </p>
            </div>
          </div>

          <Input
            label="Password Baru"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
            }
            placeholder="Min 6 karakter"
            required
          />

          <Input
            label="Konfirmasi Password"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) =>
              setPasswordForm((p) => ({
                ...p,
                confirmPassword: e.target.value,
              }))
            }
            placeholder="Ketik ulang password baru"
            required
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setModalPassword(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Ubah Password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}