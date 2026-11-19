import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z, requiredText, money, optionalText } from '@/lib/zod'
import { applyServerErrors, errorMessage } from '@/lib/api'
import { useList, useRemove, useSave } from '@/lib/queries'
import { money as fmtMoney, percent } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Money from '@/components/ui/Money'
import Modal from '@/components/ui/Modal'
import FormField, { Input, NumberInput } from '@/components/ui/FormField'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const schema = z.object({
  name: requiredText('أدخل اسم الشريك'),
  capital: money({ msg: 'أدخل رأس المال' }),
  note: optionalText(),
})

export default function PartnersPage() {
  const { data, isLoading } = useList('partners')
  const [editing, setEditing] = useState(null)

  const shareBar = (p) => (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.max(2, p.share_percent)}%` }} />
      </div>
      <span className="font-bold tabular-nums text-slate-900">{percent(p.share_percent)}</span>
    </div>
  )

  return (
    <>
      <PageHeader
        title="الشركاء ورأس المال"
        subtitle={data?.summary && `إجمالي رأس المال: ${fmtMoney(data.summary.total_capital)} — نسبة كل شريك = رأس ماله ÷ الإجمالي`}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>شريك جديد</Button>}
      />
      <Table
        loading={isLoading}
        rows={data?.data}
        onRowClick={setEditing}
        empty="لم يُضف أي شريك بعد"
        columns={[
          {
            key: 'name', header: 'الشريك', mobile: 'title',
            render: (p) => <span className="flex items-center gap-2 font-semibold text-slate-900">{p.name}{p.note && <Badge>{p.note}</Badge>}</span>,
          },
          { key: 'capital', header: 'رأس المال', mobile: 'value', render: (p) => <Money value={p.capital} className="font-semibold" /> },
          { key: 'share', header: 'النسبة', mobile: 'line', render: shareBar },
        ]}
      />
      <p className="mt-4 rounded-xl bg-slate-100 p-3 text-xs leading-6 text-slate-600">
        نصيب كل شريك من الأرباح يظهر في لوحة التحكم. الشريك الممول فقط لا يحتاج حساب دخول، ولا يظهر في «من سيوصّل» أو «دفعها».
      </p>
      {editing && <PartnerModal partner={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function PartnerModal({ partner, onClose }) {
  const save = useSave('partners')
  const remove = useRemove('partners')
  const confirm = useConfirm()
  const isEdit = !!partner.id

  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: partner.name ?? '', capital: partner.capital ?? '', note: partner.note ?? '' },
  })

  const onSubmit = (values) =>
    save.mutate({ id: partner.id, ...values }, {
      onSuccess: () => { toast.success('تم الحفظ'); onClose() },
      onError: (e) => applyServerErrors(e, setError, ['name', 'capital', 'note']).forEach((m) => toast.error(m)),
    })

  const onDelete = async () => {
    if (!(await confirm({ title: 'حذف الشريك', message: `حذف «${partner.name}»؟ ستُعاد حساب نسب الباقين تلقائياً.`, confirmText: 'حذف' }))) return
    remove.mutate(partner.id, {
      onSuccess: () => { toast.success('تم الحذف'); onClose() },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'تعديل الشريك' : 'شريك جديد'}
      size="sm"
      footer={
        <>
          <Button className="flex-1" loading={save.isPending} onClick={handleSubmit(onSubmit)}>حفظ</Button>
          {isEdit && <Button variant="ghost" icon={Trash2} className="text-rose-600" onClick={onDelete}>حذف</Button>}
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <FormField label="الاسم" required error={errors.name?.message}>
          <Input invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="رأس المال (د.ل)" required error={errors.capital?.message}>
          <NumberInput invalid={!!errors.capital} {...register('capital')} />
        </FormField>
        <FormField label="ملاحظة" hint="مثال: ممول فقط">
          <Input {...register('note')} />
        </FormField>
      </form>
    </Modal>
  )
}
