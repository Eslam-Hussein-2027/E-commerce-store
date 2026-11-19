import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z, money, optionalId } from '@/lib/zod'
import { applyServerErrors } from '@/lib/api'
import { useChangeOrderStatus } from '@/lib/queries'
import { money as fmtMoney } from '@/lib/format'
import { ORDER_STATUSES, STATUS_ACTIONS } from '@/lib/constants'
import { useAuth } from '@/auth/AuthContext'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import FormField, { NumberInput } from '@/components/ui/FormField'
import UserSelect from '@/components/UserSelect'

const MESSAGES = {
  out_for_delivery: 'سيتم تحويل الطلب إلى «خرج للتوصيل».',
  delivered: 'تأكيد تسليم الطلب للزبون واستلام المبلغ. سيُضاف ثمن البضاعة إلى عهدة من قام بالتوصيل.',
  cancelled: 'سيتم إلغاء الطلب وإرجاع كمياته إلى المخزون. لا يمكن التراجع عن الإلغاء.',
  returned: 'سيتم تسجيل الطلب كمرتجع وإرجاع كمياته إلى المخزون، ويُستبعد من الإيرادات. لا يمكن التراجع.',
  pending: 'سيعود الطلب إلى «قيد التجهيز».',
}

export default function StatusChangeDialog({ order, target, onClose, onDone }) {
  const { user } = useAuth()
  const change = useChangeOrderStatus()
  const needsCourier = target === 'delivered' || target === 'out_for_delivery'

  const schema = z.object({
    delivered_by_user_id: target === 'delivered'
      ? z.preprocess((v) => (v ? Number(v) : undefined), z.number({ error: 'اختر من قام بالتوصيل' }))
      : optionalId(),
    delivery_fee: target === 'delivered' ? money({ msg: 'أدخل سعر التوصيل' }) : z.any().optional(),
  })

  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      delivered_by_user_id: order.delivered_by_user_id ?? user?.id,
      delivery_fee: order.delivery_fee ?? 0,
    },
  })

  const onSubmit = (values) => {
    const payload = { id: order.id, status: target }
    if (needsCourier) payload.delivered_by_user_id = values.delivered_by_user_id
    if (target === 'delivered') payload.delivery_fee = values.delivery_fee

    change.mutate(payload, {
      onSuccess: () => {
        toast.success(`الطلب #${order.id}: ${ORDER_STATUSES[target].label}`)
        onDone?.()
        onClose()
      },
      onError: (e) => applyServerErrors(e, setError, ['delivered_by_user_id', 'delivery_fee']).forEach((m) => toast.error(m)),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${STATUS_ACTIONS[target].label} — طلب #${order.id}`}
      footer={
        <>
          <Button variant={STATUS_ACTIONS[target].tone} className="flex-1" loading={change.isPending} onClick={handleSubmit(onSubmit)}>
            تأكيد: {STATUS_ACTIONS[target].label}
          </Button>
          <Button variant="secondary" onClick={onClose}>تراجع</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <p className="text-sm leading-6 text-slate-700">{MESSAGES[target]}</p>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-semibold text-slate-900">{order.customer_name}</div>
          <div className="text-slate-500">قيمة البضاعة: <b dir="ltr">{fmtMoney(order.goods_total)}</b></div>
        </div>
        {needsCourier && (
          <FormField label={target === 'delivered' ? 'من قام بالتوصيل؟' : 'من سيقوم بالتوصيل؟'} required={target === 'delivered'} error={errors.delivered_by_user_id?.message}>
            <UserSelect {...register('delivered_by_user_id')} />
          </FormField>
        )}
        {target === 'delivered' && (
          <FormField label="سعر التوصيل (د.ل)" error={errors.delivery_fee?.message} hint="دخل شخصي لمن قام بالتوصيل — لا يُحسب ضمن إيرادات المتجر">
            <NumberInput {...register('delivery_fee')} />
          </FormField>
        )}
      </form>
    </Modal>
  )
}
