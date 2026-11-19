/**
 * Label + control + error/hint. Controls accept `ref` as a prop (React 19), so
 * react-hook-form's register() can be spread directly onto them.
 */
export default function FormField({ label, error, hint, required, className = '', children, htmlFor }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="ms-0.5 text-rose-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

const base =
  'block w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500'

const ring = (invalid) => (invalid ? 'ring-rose-400' : 'ring-slate-300')

export function Input({ invalid, className = '', ...props }) {
  return <input className={`${base} h-10 ${ring(invalid)} ${className}`} {...props} />
}

/** Numeric input: shows the decimal keyboard on phones and keeps digits LTR. */
export function NumberInput({ invalid, className = '', ...props }) {
  return <input type="text" inputMode="decimal" dir="ltr" autoComplete="off" className={`${base} h-10 text-end tabular-nums ${ring(invalid)} ${className}`} {...props} />
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select className={`${base} h-10 pe-8 ${ring(invalid)} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ invalid, className = '', rows = 2, ...props }) {
  return <textarea rows={rows} className={`${base} py-2 ${ring(invalid)} ${className}`} {...props} />
}
