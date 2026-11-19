import { useNavigate, useParams } from 'react-router'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/api'
import { useItem, useRemove } from '@/lib/queries'
import { date, money, num } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import EmptyState from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export default function PurchaseDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { data: p, isLoading, error } = useItem('purchases', id)
  const remove = useRemove('purchases')

  if (isLoading) return <ListSkeleton rows={3} />
  if (error || !p) return <EmptyState text="الفاتورة غير موجودة" />

  const onDelete = async () => {
    const ok = await confirm({
      title: 'حذف فاتورة الشراء',
      message: `سيتم خصم كميات الفاتورة من المخزون وإعادة حساب متوسط التكلفة، وتُلغى من عهدة ${p.paid_by?.name}. لا يمكن الحذف إذا بيعت أي كمية منها.`,
      confirmText: 'حذف الفاتورة',
    })
    if (!ok) return
    remove.mutate(p.id, {
      onSuccess: () => {
        toast.success('تم حذف الفاتورة')
        navigate('/purchases', { replace: true })
      },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <>
      <PageHeader
        title={`فاتورة شراء #${p.id}`}
        subtitle={`${p.supplier || 'بدون مورد'} · ${date(p.purchase_date)}`}
        actions={<Button variant="secondary" icon={Trash2} className="text-rose-600" loading={remove.isPending} onClick={onDelete}>حذف</Button>}
      />
      <Card bodyClassName="p-0">
        <ul className="divide-y divide-slate-100">
          {p.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900">{i.product?.name}</div>
                <div className="text-xs text-slate-500">{num(i.qty)} × <span dir="ltr">{money(i.unit_cost)}</span></div>
              </div>
              <Money value={i.line_total} className="font-bold" />
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">الإجمالي</span><Money value={p.total_cost} className="text-base font-bold" /></div>
          <div className="flex justify-between"><span className="text-slate-500">دفعها</span><span className="font-semibold">{p.paid_by?.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">سجّلها</span><span>{p.created_by_name ?? '—'}</span></div>
          {p.note && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">{p.note}</p>}
        </div>
      </Card>
    </>
  )
}
