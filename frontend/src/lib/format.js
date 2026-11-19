// Numbers use Western digits with comma grouping (e.g. 1,234.50 د.ل) — clearer than ar-LY's "1.234,50".
const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const dateFmt = new Intl.DateTimeFormat('ar-LY-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('ar-LY-u-nu-latn', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
})
const monthFmt = new Intl.DateTimeFormat('ar-LY-u-nu-latn', { month: 'short', year: '2-digit' })

export const CURRENCY = 'د.ل'

export const money = (v) => `${moneyFmt.format(Number(v) || 0)} ${CURRENCY}`
export const num = (v) => numFmt.format(Number(v) || 0)
export const percent = (v) => `${numFmt.format(Number(v) || 0)}%`

/** "2026-11-19" or ISO datetime → "19 نوفمبر 2026" */
export const date = (v) => (v ? dateFmt.format(parseDate(v)) : '—')
export const dateTime = (v) => (v ? dateTimeFmt.format(new Date(v)) : '—')
/** "2026-11" → "نوفمبر 26" */
export const monthLabel = (ym) => monthFmt.format(new Date(`${ym}-01T00:00:00`))

function parseDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v)
}

/** Local YYYY-MM-DD (not UTC). */
export function isoDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function isoDateTimeLocal(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Accepts Arabic-Indic digits (٠-٩, ۰-۹) and Arabic decimal/thousands marks typed on phones. */
export function normalizeDigits(value) {
  if (value === null || value === undefined) return value
  return String(value)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[٬,]/g, '')
    .trim()
}

export function toNumber(value) {
  if (typeof value === 'number') return value
  const s = normalizeDigits(value)
  if (s === '' || s === undefined || s === null) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
