import { money } from '@/lib/format'

/** LTR-isolated money value. `signed` colours negatives red and positives green. */
export default function Money({ value, signed = false, className = '' }) {
  const n = Number(value) || 0
  const color = signed ? (n < 0 ? 'text-rose-600' : n > 0 ? 'text-emerald-700' : '') : ''
  return (
    <span dir="ltr" className={`tabular-nums ${color} ${className}`}>
      {money(n)}
    </span>
  )
}
