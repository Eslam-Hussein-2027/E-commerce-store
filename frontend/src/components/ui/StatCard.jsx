/**
 * tone: neutral | positive | negative | warning | brand
 * Pass `negative` to auto-highlight values below zero.
 */
const TONES = {
  neutral: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  brand: { icon: 'bg-brand-50 text-brand-700', value: 'text-slate-900' },
  positive: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
  negative: { icon: 'bg-rose-50 text-rose-700', value: 'text-rose-700' },
  warning: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
}

export default function StatCard({ title, value, sub, icon: Icon, tone = 'neutral', loading, className = '' }) {
  const t = TONES[tone] ?? TONES.neutral

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">{title}</p>
        {Icon && (
          <span className={`hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex ${t.icon}`}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-3/4 animate-pulse rounded-lg bg-slate-200" />
      ) : (
        <p dir="ltr" className={`mt-1 text-end text-lg font-bold tabular-nums sm:text-xl ${t.value}`}>
          {value}
        </p>
      )}
      {sub && !loading && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
