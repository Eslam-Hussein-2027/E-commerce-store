import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { z, money, idField, optionalText } from '@/lib/zod'
import { api, applyServerErrors, errorMessage } from '@/lib/api'
import { useList, useRemove, useSave } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { dateTime, isoDateTimeLocal, money as fmtMoney } from '@/lib/format'
import { useAuth } from '@/auth/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import FilterBar from '@/components/ui/FilterBar'
import DateRangeInputs from '@/components/ui/DateRangeInputs'
import FormField, { Input, NumberInput, Textarea } from '@/components/ui/FormField'
import UserSelect from '@/components/UserSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const schema = z.object({
  user_id: idField('اختر الأخ'),
  amount: money({ positive: true }),
  handed_at: z.string().min(1, 'اختر التاريخ'),
  note: optionalText(),
})

export default function HandoversPage() {
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('cash-handovers', filters)
  // Current custody balances, so the brothers see how much they still hold.
  const { data: custody } = useQuery({ queryKey: ['dashboard', 'custody'], queryFn: () => api.get('/dashboard/custody').then((r) => r.data) })
  const [editing, setEditing] = useState(null)

  return (
    <>
      <PageHeader
        title="تسليم النقدية للصندوق"
        subtitle="عندما يسلّم أحد الإخوة النقود التي جمعها إلى صندوق المتجر المشترك"
        actions={<Button icon={Plus} onClick={() => setEditing({})}>تسليم جديد</Button>}
      />

      {custody && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          {custody.map((c) => (
            <div key={c.user_id} className={`rounded-2xl p-4 ring-1 ${c.balance < 0 ? 'bg-rose-50 ring-rose-200' : 'bg-white ring-slate-100'}`}>
              <div className="text-xs font-semibold text-slate-500">عهدة {c.name} الآن</div>
              <Money value={c.balance} className={`mt-1 block text-lg font-bold ${c.balance < 0 ? 'text-rose-700' : 'text-slate-900'}`} />
              {c.balance < 0 && <div className="text-xs text-rose-700">المتجر مدين له</div>}
            </div>
          ))}
        </div>
      )}

      <FilterBar>
        <DateRangeInputs filters={filters} setFilter={setFilter} />
        <UserSelect placeholder="الكل" value={filters.user_id ?? ''} onChange={(e) => setFilter('user_id', e.target.value)} className="col-span-2 self-end" />
      </FilterBar>

      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        onRowClick={setEditing}
        empty="لا توجد عمليات تسليم"
        columns={[
          { key: 'user', header: 'سلّمها', mobile: 'title', render: (h) => <span className="font-semibold">{h.user?.name}</span> },
          { key: 'amount', header: 'المبلغ', mobile: 'value', render: (h) => <Money value={h.amount} className="font-semibold" /> },
          { key: 'handed_at', header: 'التاريخ', mobile: 'subtitle', render: (h) => dateTime(h.handed_at) },
          { key: 'note', header: 'ملاحظة', mobile: 'line', render: (h) => h.note || '—' },
        ]}
      />
      {data?.summary && <p className="mt-3 text-sm text-slate-600">الإجمالي حسب الفلتر: <b dir="ltr">{fmtMoney(data.summary.total)}</b></p>}
      <Pagination meta={data?.meta} onPage={setPage} />
      {editing && <HandoverModal handover={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function HandoverModal({ handover, onClose }) {
  const { user } = useAuth()
  const save = useSave('cash-handovers')
  const remove = useRemove('cash-handovers')
  const confirm = useConfirm()
  const isEdit = !!handover.id

  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      user_id: handover.user_id ?? user?.id,
      amount: handover.amount ?? '',
      handed_at: handover.handed_at ? isoDateTimeLocal(new Date(handover.handed_at)) : isoDateTimeLocal(),
      note: handover.note ?? '',
    },
  })

  const onSubmit = (values) =>
    save.mutate({ id: handover.id, ...values }, {
      onSuccess: () => { toast.success('تم تسجيل التسليم'); onClose() },
      onError: (e) => applyServerErrors(e, setError, Object.keys(schema.shape)).forEach((m) => toast.error(m)),
    })

  const onDelete = async () => {
    if (!(await confirm({ title: 'حذف التسليم', message: `حذف تسليم بقيمة ${fmtMoney(handover.amount)}؟ ستعود القيمة إلى عهدة ${handover.user?.name}.`, confirmText: 'حذف' }))) return
    remove.mutate(handover.id, {
      onSuccess: () => { toast.success('تم الحذف'); onClose() },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'تعديل تسليم' : 'تسليم نقدية للصندوق'}
      footer={
        <>
          <Button className="flex-1" loading={save.isPending} onClick={handleSubmit(onSubmit)}>حفظ</Button>
          {isEdit && <Button variant="ghost" icon={Trash2} className="text-rose-600" onClick={onDelete}>حذف</Button>}
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3" noValidate>
        <FormField label="الأخ الذي سلّم" required error={errors.user_id?.message}>
          <UserSelect {...register('user_id')} />
        </FormField>
        <FormField label="المبلغ (د.ل)" required error={errors.amount?.message}>
          <NumberInput autoFocus invalid={!!errors.amount} {...register('amount')} />
        </FormField>
        <FormField label="التاريخ والوقت" required error={errors.handed_at?.message} className="col-span-2">
          <Input type="datetime-local" {...register('handed_at')} />
        </FormField>
        <FormField label="ملاحظة" className="col-span-2">
          <Textarea {...register('note')} />
        </FormField>
      </form>
    </Modal>
  )
}
