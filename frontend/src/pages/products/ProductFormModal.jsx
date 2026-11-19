import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z, requiredText, money, optionalId } from '@/lib/zod'
import { applyServerErrors, errorMessage } from '@/lib/api'
import { useRemove, useSave } from '@/lib/queries'
import { money as fmtMoney, num } from '@/lib/format'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import FormField, { Input, NumberInput, Select } from '@/components/ui/FormField'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toNumber } from '@/lib/format'

const schema = z.object({
  name: requiredText('أدخل اسم المنتج'),
  sku: requiredText('أدخل رمز المنتج'),
  category_id: optionalId(),
  sell_price: money({ msg: 'أدخل سعر البيع' }),
  reorder_level: z.preprocess((v) => toNumber(v) ?? 0, z.number({ error: 'أدخل رقماً' }).int('عدد صحيح فقط').min(0)),
  is_active: z.boolean(),
})

const FIELDS = ['name', 'sku', 'category_id', 'sell_price', 'reorder_level', 'is_active']

export default function ProductFormModal({ product, categories, onClose }) {
  const save = useSave('products')
  const remove = useRemove('products')
  const confirm = useConfirm()
  const isEdit = !!product.id

  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product.name ?? '',
      sku: product.sku ?? '',
      category_id: product.category_id ?? '',
      sell_price: product.sell_price ?? '',
      reorder_level: product.reorder_level ?? 5,
      is_active: product.is_active ?? true,
    },
  })

  const onSubmit = (values) =>
    save.mutate(
      { id: product.id, ...values },
      {
        onSuccess: () => {
          toast.success(isEdit ? 'تم تحديث المنتج' : 'تمت إضافة المنتج')
          onClose()
        },
        onError: (e) => applyServerErrors(e, setError, FIELDS).forEach((m) => toast.error(m)),
      },
    )

  const onDelete = async () => {
    if (!(await confirm({ title: 'حذف المنتج', message: `حذف «${product.name}» نهائياً؟`, confirmText: 'حذف' }))) return
    remove.mutate(product.id, {
      onSuccess: () => {
        toast.success('تم حذف المنتج')
        onClose()
      },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'تعديل المنتج' : 'منتج جديد'}
      footer={
        <>
          <Button className="flex-1" loading={save.isPending} onClick={handleSubmit(onSubmit)}>حفظ</Button>
          {isEdit && <Button variant="ghost" icon={Trash2} className="text-rose-600" loading={remove.isPending} onClick={onDelete}>حذف</Button>}
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3" noValidate>
        <FormField label="اسم المنتج" required error={errors.name?.message} className="col-span-2">
          <Input invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="الرمز (SKU)" required error={errors.sku?.message}>
          <Input dir="ltr" className="uppercase" invalid={!!errors.sku} {...register('sku')} />
        </FormField>
        <FormField label="التصنيف" error={errors.category_id?.message}>
          <Select {...register('category_id')}>
            <option value="">بدون تصنيف</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="سعر البيع (د.ل)" required error={errors.sell_price?.message}>
          <NumberInput invalid={!!errors.sell_price} {...register('sell_price')} />
        </FormField>
        <FormField label="حد إعادة الطلب" error={errors.reorder_level?.message} hint="تنبيه عند وصول المخزون لهذا الحد">
          <NumberInput inputMode="numeric" invalid={!!errors.reorder_level} {...register('reorder_level')} />
        </FormField>
        <label className="col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="size-4 accent-brand-700" {...register('is_active')} />
          منتج نشط (يظهر في نموذج الطلبات)
        </label>

        <div className="col-span-2 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
          {isEdit ? (
            <span>
              المخزون الحالي <b>{num(product.stock)}</b> بمتوسط تكلفة <b dir="ltr">{fmtMoney(product.avg_cost)}</b>.
              المخزون والتكلفة لا يُعدَّلان يدوياً — يتغيران فقط عبر المشتريات والطلبات وتسويات المخزون.
            </span>
          ) : (
            <span>يبدأ المنتج بمخزون صفر. أضف الكمية عبر فاتورة شراء ليُحسب متوسط التكلفة تلقائياً.</span>
          )}
        </div>
      </form>
    </Modal>
  )
}
