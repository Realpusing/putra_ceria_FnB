export default function EmptyState({ icon: Icon, title, description }) {
    return (
      <div className="card text-center py-12">
        {Icon && (
          <div
            className="w-16 h-16 bg-gray-100 rounded-2xl 
            flex items-center justify-center mx-auto mb-4"
          >
            <Icon size={28} className="text-gray-300" />
          </div>
        )}
        <h3 className="text-sm font-semibold text-gray-500">{title}</h3>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </div>
    )
  }