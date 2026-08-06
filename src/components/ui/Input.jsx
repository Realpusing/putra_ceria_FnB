export default function Input({
    label,
    name,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    error,
    disabled = false,
    prefix,
    suffix,
    hint,
  }) {
    return (
      <div className="space-y-1">
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
  
        {/* Input wrapper */}
        <div className="relative flex items-center">
          {/* Prefix */}
          {prefix && (
            <span className="absolute left-3 text-gray-400 text-sm pointer-events-none">
              {prefix}
            </span>
          )}
  
          {/* Input */}
          <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={`
              w-full border rounded-xl px-3 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-400 
              focus:border-transparent transition
              disabled:bg-gray-50 disabled:text-gray-400
              ${error ? 'border-red-400' : 'border-gray-300'}
              ${prefix ? 'pl-9' : ''}
              ${suffix ? 'pr-14' : ''}
            `}
          />
  
          {/* Suffix */}
          {suffix && (
            <span className="absolute right-3 text-gray-400 text-sm pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
  
        {/* Hint */}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
  
        {/* Error */}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }