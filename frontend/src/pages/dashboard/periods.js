import { isoDate } from '@/lib/format'

export const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'last_month', label: 'الشهر الماضي' },
  { key: 'custom', label: 'مخصص' },
]

/** Resolve a preset into { from, to } (local dates). */
export function resolvePeriod(key, custom = {}) {
  const now = new Date()
  switch (key) {
    case 'today':
      return { from: isoDate(now), to: isoDate(now) }
    case 'last_month':
      return {
        from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    case 'custom':
      return { from: custom.from || isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: custom.to || isoDate(now) }
    case 'month':
    default:
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) }
  }
}
