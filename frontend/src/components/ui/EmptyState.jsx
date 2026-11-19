import { Inbox } from 'lucide-react'

export default function EmptyState({ text = 'لا توجد بيانات بعد', icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-100">
      <Icon className="size-10 text-slate-300" />
      <p className="mt-3 text-sm text-slate-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
