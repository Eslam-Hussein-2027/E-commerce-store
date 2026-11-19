import { SERIES } from './chartTheme'

/**
 * Ranked horizontal bars in plain HTML (reads well with Arabic names on phones).
 * Single series → one colour (slot 1). Values are text, never the series colour.
 */
export default function RankedBars({ rows, value, format, label, sub, empty = 'لا توجد بيانات في هذه الفترة' }) {
  if (!rows?.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>
  const max = Math.max(...rows.map((r) => Math.abs(value(r))), 1)

  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => {
        const v = value(r)
        return (
          <li key={i} title={`${label(r)}: ${format(v)}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-slate-800">
                <span className="me-1.5 text-xs text-slate-400">{i + 1}</span>
                {label(r)}
              </span>
              <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-slate-900">{format(v)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (Math.abs(v) / max) * 100)}%`, background: SERIES[1] }} />
            </div>
            {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub(r)}</div>}
          </li>
        )
      })}
    </ol>
  )
}
