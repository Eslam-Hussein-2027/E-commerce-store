import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from '@/lib/zod'
import { api, applyServerErrors } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import FormField, { Input } from '@/components/ui/FormField'

const schema = z
  .object({
    current_password: z.string().min(1, 'أدخل كلمة المرور الحالية'),
    password: z.string().min(8, 'كلمة المرور الجديدة 8 أحرف على الأقل'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, { message: 'التأكيد غير مطابق', path: ['password_confirmation'] })

export default function AccountPage() {
  const { user } = useAuth()
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    try {
      await api.put('/auth/password', data)
      toast.success('تم تغيير كلمة المرور')
      reset()
    } catch (e) {
      applyServerErrors(e, setError, ['current_password', 'password']).forEach((m) => toast.error(m))
    }
  }

  return (
    <>
      <PageHeader title="الحساب" subtitle={`${user?.name} — ${user?.email}`} />
      <Card title="تغيير كلمة المرور" className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="كلمة المرور الحالية" error={errors.current_password?.message}>
            <Input type="password" dir="ltr" autoComplete="current-password" {...register('current_password')} />
          </FormField>
          <FormField label="كلمة المرور الجديدة" error={errors.password?.message}>
            <Input type="password" dir="ltr" autoComplete="new-password" {...register('password')} />
          </FormField>
          <FormField label="تأكيد كلمة المرور الجديدة" error={errors.password_confirmation?.message}>
            <Input type="password" dir="ltr" autoComplete="new-password" {...register('password_confirmation')} />
          </FormField>
          <Button type="submit" loading={isSubmitting}>حفظ</Button>
        </form>
      </Card>
    </>
  )
}
