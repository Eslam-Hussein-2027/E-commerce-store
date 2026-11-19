import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z, idField, optionalText } from '@/lib/zod'
import { applyServerErrors } from '@/lib/api'
import { useList, useProductOptions, useSave } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { dateTime, money as fmtMoney, toNumber } from '@/lib/format'
import { ADJUSTMENT_REASONS } from '@/lib/constants'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Money from '@/components/ui/Money'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import FilterBar from '@/components/ui/FilterBar'
import DateRangeInputs from '@/components/ui/DateRangeInputs'
import FormField, { NumberInput, Select, Textarea } from '@/components/ui/FormField'

const schema = z.object({
  product_id: idField('اختر المنتج'),
  direction: z.enum(['minus', 'plus']),
  qty: z.preprocess(toNumber, z.number({ error: 'أدخل الكمية' }).int('عدد صحيح فقط').min(1, 'الكمية 1 على الأقل')),
  reason: z.enum(['damaged', 'lost', 'count_correction']),
  note: optionalText(),
})

export default function AdjustmentsPage() {
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('stock-adjustments', filters)
  const { data: products } = useProductOptions()
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="تسويات المخزون"
        subtitle={data?.summary && `قيمة الخسائر حسب الفلتر: ${fmtMoney(data.summary.loss_value)}`}
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>تسوية جديدة</Button>}
      />
      <FilterBar>
        <DateRangeInputs filters={filters} setFilter={setFilter} />
        <Select value={filters.product_id ?? ''} onChange={(e) => setFilter('product_id', e.target.value)} className="self-end">
          <option value="">كل المنتجات</option>
          {products?.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filters.reason ?? ''} onChange={(e) => setFilter('reason', e.target.value)} className="self-end">
          <option value="">كل الأسباب</option>
          {Object.entries(ADJUSTMENT_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </FilterBar>
      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        empty="لا توجد تسويات"
        columns={[
          { key: 'product', header: 'المنتج', mobile: 'title', render: (a) => <span className="font-semibold">{a.product?.name}</span> },
          {
            key: 'qty', header: 'الكمية', mobile: 'value',
            render: (a) => <span dir="ltr" className={`font-bold tabular-nums ${a.qty < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{a.qty > 0 ? `+${a.qty}` : a.qty}</span>,
          },
          { key: 'reason', header: 'السبب', mobile: 'subtitle', render: (a) => <Badge tone={a.qty < 0 ? 'red' : 'green'}>{a.reason_label}</Badge> },
          { key: 'loss', header: 'قيمة الخسارة', mobile: 'line', render: (a) => (a.loss_value ? <Money value={a.loss_value} className="text-rose-600" /> : '—') },
          { key: 'date', header: 'التاريخ', mobile: 'line', render: (a) => dateTime(a.created_at) },
          { key: 'by', header: 'بواسطة', mobile: 'line', render: (a) => a.created_by_name },
          { key: 'note', header: 'ملاحظة', render: (a) => a.note || '—' },
        ]}
      />
      <Pagination meta={data?.meta} onPage={setPage} />
      {open && <AdjustmentModal products={products?.data ?? []} onClose={() => setOpen(false)} />}
    </>
  )
}

function AdjustmentModal({ products, onClose }) {
  const save = useSave('stock-adjustments')
  const { register, handleSubmit, setError, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { product_id: '', direction: 'minus', qty: 1, reason: 'damaged', note: '' },
  })
  const [productId, direction, qty] = useWatch({ control, name: ['product_id', 'direction', 'qty'] })
  const product = products.find((p) => String(p.id) === String(productId))
  const q = toNumber(qty) || 0
  const loss = product && direction === 'minus' ? q * product.avg_cost : 0

  const onSubmit = ({ direction, qty, ...rest }) =>
    save.mutate({ ...rest, qty: direction === 'minus' ? -qty : qty }, {
      onSuccess: () => { toast.success('تم تسجيل التسوية'); onClose() },
      onError: (e) => applyServerErrors(e, setError, ['product_id', 'qty', 'reason', 'note']).forEach((m) => toast.error(m)),
    })

  return (
    <Modal
      open
      onClose={onClose}
      title="تسوية مخزون"
      footer={
        <>
          <Button className="flex-1" loading={save.isPending} onClick={handleSubmit(onSubmit)}>حفظ التسوية</Button>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3" noValidate>
        <FormField label="المنتج" required error={errors.product_id?.message} className="col-span-2"
          hint={product && `المخزون الحالي: ${product.stock} · متوسط التكلفة: ${fmtMoney(product.avg_cost)}`}>
          <Select {...register('product_id')}>
            <option value="">اختر المنتج…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (متوفر {p.stock})</option>)}
          </Select>
        </FormField>
        <FormField label="الاتجاه">
          <Select {...register('direction')}>
            <option value="minus">نقص (−)</option>
            <option value="plus">زيادة (+)</option>
          </Select>
        </FormField>
        <FormField label="الكمية" required error={errors.qty?.message}>
          <NumberInput inputMode="numeric" {...register('qty')} />
        </FormField>
        <FormField label="السبب" className="col-span-2">
          <Select {...register('reason')}>
            {Object.entries(ADJUSTMENT_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="ملاحظة" className="col-span-2">
          <Textarea {...register('note')} />
        </FormField>
        {loss > 0 && (
          <div className="col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            ستُسجَّل خسارة بقيمة <b dir="ltr">{fmtMoney(loss)}</b> (بمتوسط التكلفة) وتُخصم من صافي الربح.
          </div>
        )}
        <p className="col-span-2 text-xs text-slate-500">التسويات لا تُحذف. لتصحيح خطأ سجّل تسوية معاكسة.</p>
      </form>
    </Modal>
  )
}
