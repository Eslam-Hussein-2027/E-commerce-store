import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z, requiredText, optionalText, money, intNum, idField } from '@/lib/zod'
import { api, applyServerErrors } from '@/lib/api'
import { useItem, useProductOptions, useSave } from '@/lib/queries'
import { isoDate, money as fmtMoney, normalizeDigits, toNumber } from '@/lib/format'
import { LIBYAN_AREAS } from '@/lib/constants'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import FormField, { Input, NumberInput, Select, Textarea } from '@/components/ui/FormField'
import { ListSkeleton } from '@/components/ui/Skeleton'

const schema = z.object({
  customer_name: requiredText('أدخل اسم الزبون'),
  phone: z.preprocess(normalizeDigits, z.string().regex(/^[0-9+\-\s()]{6,30}$/, 'رقم الهاتف غير صحيح')),
  area: optionalText(),
  order_date: z.string().min(1, 'اختر التاريخ'),
  delivery_fee: money({ msg: 'أدخل سعر التوصيل' }),
  note: optionalText(),
  items: z
    .array(z.object({
      product_id: idField('اختر المنتج'),
      qty: intNum({ min: 1 }),
      unit_price: money({ msg: 'أدخل السعر' }),
    }))
    .min(1, 'أضف صنفاً واحداً على الأقل')
    .superRefine((items, ctx) => {
      const seen = new Set()
      items.forEach((it, i) => {
        if (seen.has(it.product_id)) ctx.addIssue({ code: 'custom', path: [i, 'product_id'], message: 'المنتج مكرر — عدّل الكمية بدلاً من ذلك' })
        seen.add(it.product_id)
      })
    }),
})

const FIELDS = ['customer_name', 'phone', 'area', 'order_date', 'delivery_fee', 'note', 'items']
const emptyRow = { product_id: '', qty: 1, unit_price: '' }

export default function OrderFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { data: order, isLoading: orderLoading } = useItem('orders', id)
  const { data: productsRes, isLoading: productsLoading } = useProductOptions()
  const save = useSave('orders')

  const products = productsRes?.data ?? []
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])

  // When editing, the order's own quantities are already deducted → they count as available.
  const held = useMemo(() => {
    const h = {}
    order?.items?.forEach((i) => (h[i.product_id] = (h[i.product_id] ?? 0) + i.qty))
    return h
  }, [order])
  const available = (pid) => (byId[pid]?.stock ?? 0) + (held[pid] ?? 0)

  const { register, control, handleSubmit, setValue, getValues, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { customer_name: '', phone: '', area: '', order_date: isoDate(), delivery_fee: 10, note: '', items: [emptyRow] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })

  useEffect(() => {
    if (order) {
      reset({
        customer_name: order.customer_name,
        phone: order.phone,
        area: order.area ?? '',
        order_date: order.order_date,
        delivery_fee: order.delivery_fee,
        note: order.note ?? '',
        items: order.items.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.unit_price })),
      })
    }
  }, [order, reset])

  if (isEdit && order && order.status !== 'pending') return <Navigate to={`/orders/${id}`} replace />
  if ((isEdit && orderLoading) || productsLoading) return <ListSkeleton rows={4} />

  const goodsTotal = (items ?? []).reduce((sum, it) => sum + (toNumber(it.qty) || 0) * (toNumber(it.unit_price) || 0), 0)

  // Returning customer: fill name/area from their last order.
  const lookupPhone = async () => {
    const phone = normalizeDigits(getValues('phone'))
    if (isEdit || !phone || phone.length < 6 || getValues('customer_name')) return
    try {
      const { data } = await api.get('/orders', { params: { search: phone, per_page: 1 } })
      const last = data.data?.[0]
      if (last && last.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) {
        setValue('customer_name', last.customer_name)
        if (!getValues('area')) setValue('area', last.area ?? '')
        toast.info(`زبون سابق: ${last.customer_name}`)
      }
    } catch {
      /* lookup is best-effort */
    }
  }

  const onSubmit = (values) => {
    // Client-side stock check (the server checks again under a row lock).
    let blocked = false
    values.items.forEach((it, i) => {
      const avail = available(it.product_id)
      if (it.qty > avail) {
        setError(`items.${i}.qty`, { type: 'stock', message: `المتوفر ${avail} فقط` })
        blocked = true
      }
    })
    if (blocked) return toast.error('الكمية المطلوبة أكبر من المتوفر في المخزون')

    save.mutate(
      { id, ...values },
      {
        onSuccess: (saved) => {
          toast.success(isEdit ? 'تم تعديل الطلب' : `تم إنشاء الطلب #${saved.id}`)
          navigate(`/orders/${saved.id}`, { replace: true })
        },
        onError: (e) => applyServerErrors(e, setError, FIELDS).forEach((m) => toast.error(m)),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader title={isEdit ? `تعديل الطلب #${id}` : 'طلب جديد'} subtitle="يُخصم المخزون فور حفظ الطلب" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="بيانات الزبون" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <FormField label="رقم الهاتف" required error={errors.phone?.message} className="col-span-2 lg:col-span-1">
              <Input type="tel" dir="ltr" inputMode="tel" className="text-end" invalid={!!errors.phone} {...register('phone', { onBlur: lookupPhone })} />
            </FormField>
            <FormField label="اسم الزبون" required error={errors.customer_name?.message} className="col-span-2 lg:col-span-1">
              <Input invalid={!!errors.customer_name} {...register('customer_name')} />
            </FormField>
            <FormField label="المنطقة" error={errors.area?.message}>
              <Input list="areas" {...register('area')} />
              <datalist id="areas">{LIBYAN_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
            </FormField>
            <FormField label="تاريخ الطلب" error={errors.order_date?.message}>
              <Input type="date" {...register('order_date')} />
            </FormField>
            <FormField label="سعر التوصيل (د.ل)" error={errors.delivery_fee?.message} hint="لمن يوصّل — خارج إيرادات المتجر" className="col-span-2 lg:col-span-1">
              <NumberInput {...register('delivery_fee')} />
            </FormField>
            <FormField label="ملاحظة" className="col-span-2 lg:col-span-1">
              <Textarea {...register('note')} />
            </FormField>
          </div>
        </Card>

        <Card
          title="الأصناف"
          className="lg:col-span-2"
          actions={<Button size="sm" variant="secondary" icon={Plus} onClick={() => append(emptyRow)}>صنف</Button>}
        >
          {errors.items?.root?.message || errors.items?.message ? (
            <p className="mb-3 text-sm font-medium text-rose-600">{errors.items?.root?.message ?? errors.items?.message}</p>
          ) : null}

          <div className="space-y-3">
            {fields.map((field, i) => {
              const row = items?.[i] ?? {}
              const product = byId[row.product_id]
              const avail = row.product_id ? available(row.product_id) : null
              const qty = toNumber(row.qty) || 0
              const over = avail !== null && qty > avail
              const rowErr = errors.items?.[i] ?? {}
              const selectedElsewhere = new Set((items ?? []).filter((_, j) => j !== i).map((r) => String(r.product_id)))

              return (
                <div key={field.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex items-start gap-2">
                    <FormField error={rowErr.product_id?.message} className="flex-1">
                      <Select
                        invalid={!!rowErr.product_id}
                        {...register(`items.${i}.product_id`, {
                          onChange: (e) => {
                            const p = byId[e.target.value]
                            if (p) setValue(`items.${i}.unit_price`, p.sell_price)
                          },
                        })}
                      >
                        <option value="">اختر المنتج…</option>
                        {products
                          .filter((p) => p.is_active || held[p.id])
                          .map((p) => {
                            const a = available(p.id)
                            return (
                              <option key={p.id} value={p.id} disabled={(a <= 0 && String(row.product_id) !== String(p.id)) || selectedElsewhere.has(String(p.id))}>
                                {p.name} — متوفر {a}
                              </option>
                            )
                          })}
                      </Select>
                    </FormField>
                    <Button size="icon" variant="ghost" icon={Trash2} className="text-rose-600" disabled={fields.length === 1} onClick={() => remove(i)} aria-label="حذف الصنف" />
                  </div>

                  <div className="mt-2 grid grid-cols-3 items-start gap-2">
                    <FormField label="الكمية" error={rowErr.qty?.message}>
                      <NumberInput inputMode="numeric" invalid={!!rowErr.qty || over} {...register(`items.${i}.qty`)} />
                    </FormField>
                    <FormField label="سعر الوحدة" error={rowErr.unit_price?.message}>
                      <NumberInput invalid={!!rowErr.unit_price} {...register(`items.${i}.unit_price`)} />
                    </FormField>
                    <div>
                      <span className="mb-1 block text-sm font-semibold text-slate-700">الإجمالي</span>
                      <div dir="ltr" className="flex h-10 items-center justify-end text-sm font-bold tabular-nums text-slate-900">
                        {fmtMoney(qty * (toNumber(row.unit_price) || 0))}
                      </div>
                    </div>
                  </div>

                  {product && (
                    <p className={`mt-1 text-xs ${over ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                      المتوفر في المخزون: {avail}
                      {over && ' — الكمية المطلوبة أكبر من المتوفر'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Sticky total + save */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200 md:bottom-4">
        <div>
          <div className="text-xs text-slate-500">قيمة البضاعة</div>
          <div dir="ltr" className="text-end text-xl font-bold tabular-nums text-slate-900">{fmtMoney(goodsTotal)}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>إلغاء</Button>
          <Button type="submit" size="lg" loading={save.isPending || isSubmitting}>{isEdit ? 'حفظ التعديل' : 'حفظ الطلب'}</Button>
        </div>
      </div>
    </form>
  )
}
