import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z, optionalText, money, intNum, idField, optionalId } from '@/lib/zod'
import { applyServerErrors } from '@/lib/api'
import { useProductOptions, useSave } from '@/lib/queries'
import { isoDate, money as fmtMoney, toNumber } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import FormField, { Input, NumberInput, Select, Textarea } from '@/components/ui/FormField'
import UserSelect from '@/components/UserSelect'
import { ListSkeleton } from '@/components/ui/Skeleton'

const schema = z.object({
  supplier: optionalText(),
  purchase_date: z.string().min(1, 'اختر التاريخ'),
  paid_by_user_id: optionalId(),
  note: optionalText(),
  items: z
    .array(z.object({
      product_id: idField('اختر المنتج'),
      qty: intNum({ min: 1 }),
      unit_cost: money({ msg: 'أدخل تكلفة الوحدة' }),
    }))
    .min(1, 'أضف صنفاً واحداً على الأقل')
    .superRefine((items, ctx) => {
      const seen = new Set()
      items.forEach((it, i) => {
        if (seen.has(it.product_id)) ctx.addIssue({ code: 'custom', path: [i, 'product_id'], message: 'المنتج مكرر' })
        seen.add(it.product_id)
      })
    }),
})

const emptyRow = { product_id: '', qty: 1, unit_cost: '' }

/** Same formula as the backend (PurchaseService::weightedAverage). */
const weightedAverage = (stock, avg, qty, cost) => {
  const s = Math.max(0, stock)
  return s + qty > 0 ? (s * avg + qty * cost) / (s + qty) : cost
}

export default function PurchaseFormPage() {
  const navigate = useNavigate()
  const { data: productsRes, isLoading } = useProductOptions()
  const save = useSave('purchases')
  const products = productsRes?.data ?? []
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { supplier: '', purchase_date: isoDate(), paid_by_user_id: '', note: '', items: [emptyRow] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })

  if (isLoading) return <ListSkeleton rows={3} />

  const total = (items ?? []).reduce((s, it) => s + (toNumber(it.qty) || 0) * (toNumber(it.unit_cost) || 0), 0)

  const onSubmit = (values) =>
    save.mutate(values, {
      onSuccess: (p) => {
        toast.success(`تم حفظ فاتورة الشراء #${p.id} وتحديث المخزون`)
        navigate(`/purchases/${p.id}`, { replace: true })
      },
      onError: (e) => applyServerErrors(e, setError, ['supplier', 'purchase_date', 'paid_by_user_id', 'note', 'items']).forEach((m) => toast.error(m)),
    })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader title="فاتورة شراء جديدة" subtitle="تزيد المخزون وتحدّث متوسط التكلفة تلقائياً" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="بيانات الفاتورة">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <FormField label="المورد" className="col-span-2 lg:col-span-1">
              <Input {...register('supplier')} />
            </FormField>
            <FormField label="تاريخ الشراء" required error={errors.purchase_date?.message}>
              <Input type="date" {...register('purchase_date')} />
            </FormField>
            <FormField label="دفعها" error={errors.paid_by_user_id?.message} hint="اختر أخاً فقط إذا دفع من النقود التي معه، فتُخصم من عهدته">
              <UserSelect placeholder="من رأس المال / الصندوق" {...register('paid_by_user_id')} />
            </FormField>
            <FormField label="ملاحظة" className="col-span-2 lg:col-span-1">
              <Textarea {...register('note')} />
            </FormField>
          </div>
        </Card>

        <Card title="الأصناف" className="lg:col-span-2" actions={<Button size="sm" variant="secondary" icon={Plus} onClick={() => append(emptyRow)}>صنف</Button>}>
          {errors.items?.message && <p className="mb-3 text-sm font-medium text-rose-600">{errors.items.message}</p>}
          <div className="space-y-3">
            {fields.map((field, i) => {
              const row = items?.[i] ?? {}
              const p = byId[row.product_id]
              const qty = toNumber(row.qty) || 0
              const cost = toNumber(row.unit_cost)
              const rowErr = errors.items?.[i] ?? {}
              const newAvg = p && qty > 0 && Number.isFinite(cost) ? weightedAverage(p.stock, p.avg_cost, qty, cost) : null

              return (
                <div key={field.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex items-start gap-2">
                    <FormField error={rowErr.product_id?.message} className="flex-1">
                      <Select invalid={!!rowErr.product_id} {...register(`items.${i}.product_id`)}>
                        <option value="">اختر المنتج…</option>
                        {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                      </Select>
                    </FormField>
                    <Button size="icon" variant="ghost" icon={Trash2} className="text-rose-600" disabled={fields.length === 1} onClick={() => remove(i)} aria-label="حذف الصنف" />
                  </div>
                  <div className="mt-2 grid grid-cols-3 items-start gap-2">
                    <FormField label="الكمية" error={rowErr.qty?.message}>
                      <NumberInput inputMode="numeric" invalid={!!rowErr.qty} {...register(`items.${i}.qty`)} />
                    </FormField>
                    <FormField label="تكلفة الوحدة" error={rowErr.unit_cost?.message}>
                      <NumberInput invalid={!!rowErr.unit_cost} {...register(`items.${i}.unit_cost`)} />
                    </FormField>
                    <div>
                      <span className="mb-1 block text-sm font-semibold text-slate-700">الإجمالي</span>
                      <div dir="ltr" className="flex h-10 items-center justify-end text-sm font-bold tabular-nums">{fmtMoney(qty * (cost || 0))}</div>
                    </div>
                  </div>
                  {p && (
                    <p className="mt-1 text-xs text-slate-500">
                      المخزون {p.stock} بمتوسط <span dir="ltr">{fmtMoney(p.avg_cost)}</span>
                      {newAvg !== null && <> ← المتوسط الجديد <b dir="ltr" className="text-slate-800">{fmtMoney(newAvg)}</b></>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200 md:bottom-4">
        <div>
          <div className="text-xs text-slate-500">إجمالي الفاتورة</div>
          <div dir="ltr" className="text-end text-xl font-bold tabular-nums">{fmtMoney(total)}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>إلغاء</Button>
          <Button type="submit" size="lg" loading={save.isPending}>حفظ الفاتورة</Button>
        </div>
      </div>
    </form>
  )
}
