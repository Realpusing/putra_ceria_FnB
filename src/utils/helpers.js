import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

export const formatRupiah = (angka) => {
  if (!angka && angka !== 0) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka)
}

export const formatTanggal = (date) => {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMMM yyyy', { locale: id })
}

export const formatTanggalPendek = (date) => {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM', { locale: id })
}

export const formatJam = (time) => {
  if (!time) return '-'
  return time.slice(0, 5)
}

// Hitung cup sistem per jenis
export const hitungCupSistemPerJenis = (shiftCup) => {
  if (!shiftCup) return 0
  return (
    shiftCup.cup_awal +
    shiftCup.cup_masuk -
    shiftCup.cup_terpakai -
    shiftCup.cup_rusak
  )
}

// Hitung selisih per jenis
export const hitungSelisihPerJenis = (shiftCup) => {
  if (
    !shiftCup ||
    shiftCup.cup_akhir_fisik === null ||
    shiftCup.cup_akhir_fisik === undefined
  ) {
    return null
  }
  return shiftCup.cup_akhir_fisik - hitungCupSistemPerJenis(shiftCup)
}

// Legacy - hitung dari tabel shifts langsung
export const hitungCupSistem = (shift) => {
  if (!shift) return 0
  return (
    shift.cup_awal +
    shift.cup_masuk -
    shift.cup_terpakai -
    shift.cup_rusak
  )
}

export const hitungSelisih = (shift) => {
  if (
    !shift ||
    shift.cup_akhir_fisik === null ||
    shift.cup_akhir_fisik === undefined
  ) {
    return null
  }
  return shift.cup_akhir_fisik - hitungCupSistem(shift)
}

export const getStatusBadge = (status) => {
  const map = {
    hadir: { label: 'Hadir', color: 'green' },
    telat: { label: 'Telat', color: 'yellow' },
    izin: { label: 'Izin', color: 'blue' },
    sakit: { label: 'Sakit', color: 'purple' },
    alpha: { label: 'Alpha', color: 'red' },
    open: { label: 'Berjalan', color: 'green' },
    closed: { label: 'Selesai', color: 'gray' },
  }
  return map[status] || { label: status, color: 'gray' }
}

export const getCurrentShift = () => {
  const jam = new Date().getHours()
  if (jam >= 9 && jam < 16) return 'pagi'
  if (jam >= 16 && jam < 22) return 'malam'
  return null
}

export const getToday = () => {
  return new Date().toISOString().split('T')[0]
}

export const getTimeNow = () => {
  return new Date().toTimeString().slice(0, 8)
}

export const hitungDurasi = (jamMasuk, jamPulang) => {
  if (!jamMasuk || !jamPulang) return '-'
  const [jm, mm] = jamMasuk.split(':').map(Number)
  const [jp, mp] = jamPulang.split(':').map(Number)
  const totalMenit = jp * 60 + mp - (jm * 60 + mm)
  if (totalMenit <= 0) return '-'
  const jam = Math.floor(totalMenit / 60)
  const menit = totalMenit % 60
  return `${jam}j ${menit}m`
}

// Hitung profit
export const hitungProfit = (hargaJual, hargaHpp, qty = 1) => {
  return (hargaJual - hargaHpp) * qty
}