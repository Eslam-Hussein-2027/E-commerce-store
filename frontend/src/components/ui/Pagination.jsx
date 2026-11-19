import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Works with Laravel's paginated resource "meta" block. */
export default function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null
  const { current_page: page, last_page: last, total } = meta

  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
      >
        <ChevronRight className="size-4" /> السابق
      </button>
      <span className="text-slate-500">
        صفحة {page} من {last} <span className="hidden sm:inline">· {total} سجل</span>
      </span>
      <button
        type="button"
        disabled={page >= last}
        onClick={() => onPage(page + 1)}
        className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
      >
        التالي <ChevronLeft className="size-4" />
      </button>
    </div>
  )
}
