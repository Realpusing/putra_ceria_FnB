import { Loader2 } from 'lucide-react'

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  fullWidth = false,
}) {
  const base = `
    inline-flex items-center justify-center gap-2 
    font-semibold px-4 py-2.5 rounded-xl 
    transition-colors duration-200 text-sm
    disabled:opacity-50 disabled:cursor-not-allowed
  `

  const variants = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    ghost: 'hover:bg-gray-100 text-gray-600',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base} 
        ${variants[variant]} 
        ${fullWidth ? 'w-full' : ''} 
        ${className}
      `}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}