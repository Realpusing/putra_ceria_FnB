import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'

const variants = {
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: XCircle,
  },
  success: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    icon: CheckCircle,
  },
  warning: {
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    icon: Info,
  },
}

export default function Alert({ type = 'info', children }) {
  const v = variants[type] || variants.info
  const Icon = v.icon

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${v.bg}`}>
      <Icon size={18} className={`${v.text} flex-shrink-0 mt-0.5`} />
      <div className={`text-sm ${v.text} flex-1`}>{children}</div>
    </div>
  )
}