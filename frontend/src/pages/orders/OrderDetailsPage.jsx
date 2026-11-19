import { Link, useParams } from 'react-router'
import { History, MapPin, MessageCircle, Pencil, Phone } from 'lucide-react'
import { useItem } from '@/lib/queries'
import { date, dateTime, num } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import StatusBadge from '@/components/ui/StatusBadge'
import { ListSkeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import OrderStatusActions from './OrderStatusActions'

/** Libyan mobile 09xxxxxxxx → 2189xxxxxxxx for WhatsApp links. */
const waNumber = (phone) => {
  const d = (phone || '').replace(/\D/g, '')
  if (d.startsWith('218')) return d
  if (d.startsWith('0')) return `218${d.slice(1)}`
  return d
}

export default function OrderDetailsPage() {
  const { id } = useParams()
  const { data: o, isLoading, error } = useItem('orders', id)

  if (isLoading) return <ListSkeleton rows={3} />
  if (error || !o) return <EmptyState text="الطلب غير موجود" />

  const excluded = o.status === 'cancelled' || o.status === 'returned'

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">طلب #{o.id} <StatusBadge status={o.status} /></span>}
        subtitle={`${date(o.order_date)} · أُنشئ بواسطة ${o.created_by_name ?? '—'}`}
        actions={o.status === 'pending' && (
          <Link to={`/orders/${o.id}/edit`}><Button variant="secondary" icon={Pencil}>تعديل</Button></Link>
        )}
      />

      <OrderStatusActions order={o} size="md" className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="الزبون">
          <div className="space-y-2 text-sm">
            <div className="text-base font-bold text-slate-900">{o.customer_name}</div>
            <div className="flex flex-wrap gap-2">
              <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700" dir="ltr">
                <Phone className="size-4" /> {o.phone}
              </a>
              <a href={`https://wa.me/${waNumber(o.phone)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                <MessageCircle className="size-4" /> واتساب
              </a>
            </div>
            {o.area && <div className="flex items-center gap-1.5 text-slate-600"><MapPin className="size-4" /> {o.area}</div>}
            {o.note && <div className="rounded-lg bg-amber-50 p-2 text-amber-900">{o.note}</div>}
          </div>
        </Card>

        <Card title="الأصناف" className="lg:col-span-2" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{i.product?.name}</div>
                  <div className="text-xs text-slate-500">
                    {num(i.qty)} × <Money value={i.unit_price} /> · تكلفة <Money value={i.unit_cost} />
                  </div>
                </div>
                <div className="text-end">
                  <Money value={i.line_total} className="font-bold text-slate-900" />
                  <div className="text-xs">ربح <Money value={i.line_profit} signed /></div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
            <Row label="قيمة البضاعة (إيراد المتجر)"><Money value={o.goods_total} className="font-bold" /></Row>
            <Row label="الربح الإجمالي"><Money value={o.gross_profit} signed className="font-semibold" /></Row>
            <Row label="سعر التوصيل (دخل شخصي للموصّل)"><Money value={o.delivery_fee} className="text-slate-500" /></Row>
            <Row label="يحصّله الموصّل من الزبون"><Money value={o.goods_total + o.delivery_fee} className="font-semibold" /></Row>
          </dl>
          {excluded && <p className="px-4 pb-3 text-xs text-rose-600">هذا الطلب مستبعد من الإيرادات والأرباح، وأُعيدت كمياته إلى المخزون.</p>}
        </Card>

        <Card title="التوصيل" className="lg:col-span-1">
          <dl className="space-y-1.5 text-sm">
            <Row label="الموصّل">{o.delivered_by?.name ?? '—'}</Row>
            <Row label="وقت التسليم">{dateTime(o.delivered_at)}</Row>
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <Link to={`/movements?reference_type=order&reference_id=${o.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
            <History className="size-4" /> حركات المخزون لهذا الطلب
          </Link>
        </div>
      </div>
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  )
}
