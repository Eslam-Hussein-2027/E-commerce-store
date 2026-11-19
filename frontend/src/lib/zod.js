import { z } from 'zod'
import { toNumber } from './format'

// Zod helpers with Arabic messages. Numbers accept Arabic-Indic digits.
export const requiredText = (msg = 'هذا الحقل مطلوب') => z.string().trim().min(1, msg)
export const optionalText = () => z.string().trim().optional().or(z.literal(''))

export const money = ({ min = 0, msg = 'أدخل مبلغاً صحيحاً', positive = false } = {}) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: msg })
      .refine((n) => (positive ? n > 0 : n >= min), positive ? 'يجب أن يكون المبلغ أكبر من صفر' : `يجب ألا يقل عن ${min}`),
  )

export const intNum = ({ min = 1, msg = 'أدخل عدداً صحيحاً' } = {}) =>
  z.preprocess(toNumber, z.number({ error: msg }).int(msg).min(min, `يجب ألا يقل عن ${min}`))

export const idField = (msg = 'اختر من القائمة') =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number({ error: msg }))

export const optionalId = () =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().nullable())

export { z }
