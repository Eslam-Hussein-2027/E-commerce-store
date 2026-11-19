import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

/** Debounced search box (350 ms). */
export default function SearchInput({ value, onChange, placeholder = 'بحث…', className = '' }) {
  const [text, setText] = useState(value ?? '')

  useEffect(() => setText(value ?? ''), [value])

  useEffect(() => {
    if ((value ?? '') === text) return
    const t = setTimeout(() => onChange(text), 350)
    return () => clearTimeout(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-slate-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="block h-10 w-full rounded-xl border-0 bg-white ps-9 pe-9 text-sm shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600"
      />
      {text && (
        <button type="button" onClick={() => setText('')} className="absolute inset-y-0 end-2 my-auto h-6 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="مسح">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
