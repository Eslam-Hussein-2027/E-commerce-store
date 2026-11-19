import { useState } from 'react'
import { CheckCircle2, RotateCcw, Truck, Undo2, XCircle } from 'lucide-react'
import { STATUS_ACTIONS } from '@/lib/constants'
import Button from '@/components/ui/Button'
import StatusChangeDialog from './StatusChangeDialog'

const ICONS = { out_for_delivery: Truck, delivered: CheckCircle2, cancelled: XCircle, returned: Undo2, pending: RotateCcw }
// Primary actions first
const ORDER = ['out_for_delivery', 'delivered', 'returned', 'cancelled', 'pending']

/** Quick status buttons for the transitions the backend allows. */
export default function OrderStatusActions({ order, size = 'sm', className = '' }) {
  const [target, setTarget] = useState(null)
  const targets = ORDER.filter((s) => order.allowed_transitions?.includes(s))

  if (!targets.length) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      {targets.map((s) => {
        const action = STATUS_ACTIONS[s]
        const solid = s === 'delivered' || s === 'out_for_delivery'
        return (
          <Button
            key={s}
            size={size}
            variant={solid ? action.tone : 'secondary'}
            icon={ICONS[s]}
            className={!solid && (s === 'cancelled' || s === 'returned') ? 'text-rose-700' : ''}
            onClick={() => setTarget(s)}
          >
            {action.label}
          </Button>
        )
      })}
      {target && <StatusChangeDialog order={order} target={target} onClose={() => setTarget(null)} />}
    </div>
  )
}
