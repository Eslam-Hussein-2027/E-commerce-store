import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { LogOut, Menu, Store } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useConfirm } from './ui/ConfirmDialog'
import Modal from './ui/Modal'
import { NAV } from './nav'

export default function Layout() {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMoreOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  const askLogout = async () => {
    if (await confirm({ title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج من هذا الجهاز؟', confirmText: 'خروج', tone: 'danger' })) {
      logout()
    }
  }

  const secondary = NAV.filter((n) => !n.primary)
  const moreActive = secondary.some((n) => location.pathname.startsWith(n.to))

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-700 text-white">
            <Store className="size-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900">مخزون المتجر</div>
            <div className="text-xs text-slate-500">إدارة المخزون والمبيعات</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 px-2 text-xs text-slate-500">
            مسجل باسم <span className="font-semibold text-slate-800">{user?.name}</span>
          </div>
          <button onClick={askLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
            <LogOut className="size-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Store className="size-4" />
            </span>
            <span className="font-bold text-slate-900">مخزون المتجر</span>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{user?.name}</span>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.primary).map((item) => (
            <BottomLink key={item.to} item={item} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${moreActive ? 'text-brand-700' : 'text-slate-500'}`}
          >
            <Menu className="size-5" />
            المزيد
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد">
        <div className="grid grid-cols-2 gap-2">
          {secondary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ring-1 ${isActive ? 'bg-brand-50 text-brand-800 ring-brand-200' : 'text-slate-700 ring-slate-200'}`
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
          <button onClick={askLogout} className="flex items-center gap-2 rounded-xl p-3 text-sm font-semibold text-rose-600 ring-1 ring-rose-200">
            <LogOut className="size-5" /> تسجيل الخروج
          </button>
        </div>
      </Modal>
    </div>
  )
}

function SideLink({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`
      }
    >
      <item.icon className="size-5" />
      {item.label}
    </NavLink>
  )
}

function BottomLink({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}
    >
      <item.icon className="size-5" />
      {item.label}
    </NavLink>
  )
}
