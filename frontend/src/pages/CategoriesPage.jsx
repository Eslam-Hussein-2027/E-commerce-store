import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z, requiredText } from '@/lib/zod'
import { applyServerErrors, errorMessage } from '@/lib/api'
import { useList, useRemove, useSave } from '@/lib/queries'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import FormField, { Input } from '@/components/ui/FormField'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const schema = z.object({ name: requiredText('أدخل اسم التصنيف') })

export default function CategoriesPage() {
  const { data, isLoading } = useList('categories', { all: 1 })
  const remove = useRemove('categories')
  const confirm = useConfirm()
  const [editing, setEditing] = useState(null) // null | {} | category

  const onDelete = async (cat) => {
    if (!(await confirm({ title: 'حذف التصنيف', message: `حذف «${cat.name}»؟`, confirmText: 'حذف' }))) return
    remove.mutate(cat.id, {
      onSuccess: () => toast.success('تم حذف التصنيف'),
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  const actions = (cat) => (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="icon" variant="ghost" icon={Pencil} onClick={() => setEditing(cat)} aria-label="تعديل" />
      <Button size="icon" variant="ghost" icon={Trash2} className="text-rose-600" onClick={() => onDelete(cat)} aria-label="حذف" />
    </div>
  )

  return (
    <>
      <PageHeader title="التصنيفات" actions={<Button icon={Plus} onClick={() => setEditing({})}>تصنيف جديد</Button>} />
      <Table
        loading={isLoading}
        rows={data?.data}
        empty="لا توجد تصنيفات بعد"
        columns={[
          { key: 'name', header: 'الاسم', mobile: 'title', className: 'font-semibold text-slate-900' },
          { key: 'products_count', header: 'عدد المنتجات', mobile: 'subtitle', render: (c) => `${c.products_count} منتج` },
          { key: 'actions', header: '', render: actions, mobile: 'value' },
        ]}
      />
      {editing && <CategoryModal category={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function CategoryModal({ category, onClose }) {
  const save = useSave('categories')
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: category.name ?? '' },
  })

  const onSubmit = (values) =>
    save.mutate(
      { id: category.id, ...values },
      {
        onSuccess: () => {
          toast.success('تم الحفظ')
          onClose()
        },
        onError: (e) => applyServerErrors(e, setError, ['name']).forEach((m) => toast.error(m)),
      },
    )

  return (
    <Modal
      open
      onClose={onClose}
      title={category.id ? 'تعديل التصنيف' : 'تصنيف جديد'}
      size="sm"
      footer={
        <>
          <Button className="flex-1" loading={save.isPending} onClick={handleSubmit(onSubmit)}>حفظ</Button>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="اسم التصنيف" required error={errors.name?.message}>
          <Input autoFocus invalid={!!errors.name} {...register('name')} />
        </FormField>
      </form>
    </Modal>
  )
}
