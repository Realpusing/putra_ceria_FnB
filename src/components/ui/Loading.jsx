export default function Loading({ text = 'Memuat...' }) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div
          className="animate-spin w-8 h-8 border-4 border-orange-500 
          border-t-transparent rounded-full"
        />
        <p className="text-sm text-gray-400">{text}</p>
      </div>
    )
  }