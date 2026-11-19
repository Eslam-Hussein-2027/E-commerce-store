import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z, money, idField, optionalText } from '@/lib/zod'
import { applyServerErrors, errorMessage } from '@/lib/api'
import { useList, useRemove, useSave } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { date, isoDate, money as fmtMoney } from '@/lib/format'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import { useAuth } from '@/auth/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Money from '@/components/ui/Money'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import FilterBar from '@/components/ui/FilterBar'
import DateRangeInputs from '@/components/ui/DateRangeInputs'
import FormField, { Input, NumberInput, Select, Textarea } from '@/components/ui/FormField'
import UserSelect from '@/components/UserSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const schema = z.object({
  category: z.enum(['ads', 'packaging', 'other'], { error: 'اختر نوع المصروف' }),
  amount: money({ positive: true }),
  expense_date: z.string().min(1, 'اختر التاريخ'),
  paid_by_user_id: idField('اختر من دفع'),
  note: optionalText(),
})

export default function ExpensesPage() {
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('expenses', filters)
  const [editing, setEditing] = useState(null)

  return (
    <>
      <PageHeader
        title="المصروفات"
        subtitle={data?.summary && `الإجمالي حسب الفلتر: ${fmtMoney(data.summary.total)}`}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>مصروف جديد</Button>}
      />
      <FilterBar>
        <DateRangeInputs filters={filters} setFilter={setFilter} />
        <Select value={filters.category ?? ''} onChange={(e) => setFilter('category', e.target.value)} className="self-end">
          <option value="">كل الأنواع</option>
          {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <UserSelect placeholder="كل الدافعين" value={filters.user_id ?? ''} onChange={(e) => setFilter('user_id', e.target.value)} className="self-end" />
      </FilterBar>
      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        onRowClick={setEditing}
        empty="لا توجد مصروفات"
        columns={[
          { key: 'category', header: 'النوع', mobile: 'title', render: (e) => <Badge tone="sky">{e.category_label}</Badge> },
          { key: 'amount', header: 'المبلغ', mobile: 'value', render: (e) => <Money value={e.amount} className="font-semibold" /> },
          { key: 'expense_date', header: 'التاريخ', mobile: 'line', render: (e) => date(e.expense_date) },
          { key: 'paid_by', header: 'دفعها', mobile: 'line', render: (e) => e.paid_by?.name },
          { key: 'note', header: 'ملاحظة', mobile: 'subtitle', render: (e) => e.note || '—', className: 'max-w-xs truncate' },
        ]}
      />
      <Pagination meta={data?.meta} onPage={setPage} />
      {editing && <ExpenseModal expense={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function ExpenseModal({ expense, onClose }) {
  const { user } = useAuth()
  const save = useSave('expenses')
  const remove = useRemove('expenses')
  const confirm = useConfirm()
  const isEdit = !!expense.id

  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      category: expense.category ?? 'ads',
      amount: expense.amount ?? '',
      expense_date: expense.expense_date ?? isoDate(),
      paid_by_user_id: expense.paid_by_user_id ?? user?.id,
      note: expense.note ?? '',
    },
  })

  const onSubmit = (values) =>
    save.mutate({ id: expense.id, ...values }, {
      onSuccess: () => { toast.success('تم حفظ المصروف'); onClose() },
      onError: (e) => applyServerErrors(e, setError, Object.keys(schema.shape)).forEach((m) => toast.error(m)),
    })

  const onDelete = async () => {
    if (!(await confirm({ title: 'حذف المصروف', message: `حذف مصروف بقيمة ${fmtMoney(expense.amount)}؟`, confirmText: 'حذف' }))) return
    remove.mutate(expense.id, {
      onSuccess: () => { toast.success('تم الحذف'); onClose() },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'تعديل مصروف' : 'مصروف جديد'}
      footer={
        <>
          <Button className="flex-1" loading={save.isPending} onClick={handleSubmit(onSubmit)}>حفظ</Button>
          {isEdit && <Button variant="ghost" icon={Trash2} className="text-rose-600" onClick={onDelete}>حذف</Button>}
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3" noValidate>
        <FormField label="النوع" required error={errors.category?.message}>
          <Select {...register('category')}>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="المبلغ (د.ل)" required error={errors.amount?.message}>
          <NumberInput autoFocus invalid={!!errors.amount} {...register('amount')} />
        </FormField>
        <FormField label="التاريخ" required error={errors.expense_date?.message}>
          <Input type="date" {...register('expense_date')} />
        </FormField>
        <FormField label="دفعها" required error={errors.paid_by_user_id?.message} hint="تُخصم من عهدته">
          <UserSelect {...register('paid_by_user_id')} />
        </FormField>
        <FormField label="ملاحظة" className="col-span-2">
          <Textarea {...register('note')} />
        </FormField>
        <p className="col-span-2 text-xs text-slate-500">مصاريف البنزين والمشاوير ليست مصروفات للمتجر — يغطيها سعر التوصيل.</p>
      </form>
    </Modal>
  )
}
