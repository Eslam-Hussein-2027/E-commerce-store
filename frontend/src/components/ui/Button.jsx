import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  sky: 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  rose: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
  slate: 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
}

export default function Button({
  variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', children, disabled, type = 'button', ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  )
}
