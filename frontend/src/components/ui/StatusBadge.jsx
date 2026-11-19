import { ORDER_STATUSES } from '@/lib/constants'

export default function StatusBadge({ status, className = '' }) {
  const s = ORDER_STATUSES[status] ?? { label: status, badge: 'bg-slate-100 text-slate-700 ring-slate-500/20', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.badge} ${className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
