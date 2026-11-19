export default function Card({ title, subtitle, actions, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <section className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
