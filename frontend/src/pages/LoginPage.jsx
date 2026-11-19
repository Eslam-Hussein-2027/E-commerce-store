import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Store } from 'lucide-react'
import { z } from '@/lib/zod'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import Button from '@/components/ui/Button'
import FormField, { Input } from '@/components/ui/FormField'

const schema = z.object({
  email: z.string().trim().min(1, 'أدخل البريد الإلكتروني').email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(1, 'أدخل كلمة المرور'),
})

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  if (user) return <Navigate to="/" replace />

  const onSubmit = async ({ email, password }) => {
    setServerError('')
    try {
      await login(email, password)
      navigate(location.state?.from?.pathname ?? '/', { replace: true })
    } catch (e) {
      setServerError(errorMessage(e))
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lg shadow-brand-700/20">
            <Store className="size-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">مخزون المتجر</h1>
          <p className="mt-1 text-sm text-slate-500">سجّل الدخول للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100" noValidate>
          {serverError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{serverError}</div>}
          <FormField label="البريد الإلكتروني" error={errors.email?.message}>
            <Input type="email" dir="ltr" autoComplete="username" inputMode="email" invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="كلمة المرور" error={errors.password?.message}>
            <Input type="password" dir="ltr" autoComplete="current-password" invalid={!!errors.password} {...register('password')} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            دخول
          </Button>
        </form>
      </div>
    </div>
  )
}
