import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Bike, Boxes, Coins, Percent, Receipt, RotateCcw, ShoppingCart, TrendingDown, TrendingUp, Wallet, PackageX,
} from 'lucide-react'
import { api, errorMessage } from '@/lib/api'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { date, money, num, percent } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import Money from '@/components/ui/Money'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { CardsSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/FormField'
import { PERIODS, resolvePeriod } from './periods'
import MonthlyChart from './MonthlyChart'
import RankedBars from './RankedBars'

export default function DashboardPage() {
  const { filters, setFilter } = useUrlFilters({ period: 'month' })
  const period = filters.period
  const { from, to } = resolvePeriod(period, filters)

  const { data: d, isLoading, isFetching, error } = useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () => api.get('/dashboard', { params: { from, to } }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const k = d?.kpis

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle={from === to ? date(from) : `${date(from)} — ${date(to)}`}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setFilter('period', p.key === 'month' ? '' : p.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${period === p.key ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFilter('from', e.target.value)} className="w-40" aria-label="من" />
              <Input type="date" value={to} onChange={(e) => setFilter('to', e.target.value)} className="w-40" aria-label="إلى" />
            </div>
          )}
          {isFetching && !isLoading && <span className="pb-2 text-xs text-slate-400">جارٍ التحديث…</span>}
        </div>
      </PageHeader>

      {error && <EmptyState icon={AlertTriangle} text={errorMessage(error)} />}

      {/* KPI tiles */}
      {isLoading ? (
        <CardsSkeleton count={10} />
      ) : k ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard title="الإيرادات" value={money(k.revenue)} icon={Coins} tone="brand" sub="قيمة البضاعة المسلّمة فقط" />
          <StatCard title="الربح الإجمالي" value={money(k.gross_profit)} icon={TrendingUp} tone={k.gross_profit < 0 ? 'negative' : 'neutral'} sub={`هامش ${percent(k.gross_margin)}`} />
          <StatCard title="المصروفات" value={money(k.expenses)} icon={Receipt} />
          <StatCard title="خسائر المخزون" value={money(k.stock_losses)} icon={PackageX} tone={k.stock_losses > 0 ? 'warning' : 'neutral'} sub="تالف/مفقود بمتوسط التكلفة" />
          <StatCard title="صافي الربح" value={money(k.net_profit)} icon={k.net_profit < 0 ? TrendingDown : TrendingUp} tone={k.net_profit < 0 ? 'negative' : 'positive'} />
          <StatCard title="هامش الربح الصافي" value={percent(k.net_margin)} icon={Percent} tone={k.net_margin < 0 ? 'negative' : 'neutral'} />
          <StatCard title="قيمة المخزون الحالية" value={money(k.stock_value)} icon={Boxes} sub="المخزون × متوسط التكلفة" />
          <StatCard title="الطلبات المسلّمة" value={num(k.orders_count)} icon={ShoppingCart} sub={`${num(k.orders_created)} طلب جديد في الفترة`} />
          <StatCard title="متوسط قيمة الطلب" value={money(k.avg_order_value)} icon={Wallet} />
          <StatCard
            title="نسبة الإلغاء والإرجاع"
            value={percent(k.return_rate)}
            icon={RotateCcw}
            tone={k.return_rate >= 15 ? 'warning' : 'neutral'}
            sub={`${k.cancelled_count} ملغي · ${k.returned_count} مرتجع`}
          />
        </div>
      ) : null}

      {/* Cash custody */}
      <section className="mt-6">
        <h2 className="mb-2 text-base font-bold text-slate-900">العهدة النقدية لكل أخ <span className="text-xs font-normal text-slate-500">(الرصيد الحالي — لا يتأثر بفلتر التاريخ)</span></h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {isLoading
            ? [0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
            : d?.custody.map((c) => <CustodyCard key={c.user_id} c={c} />)}
        </div>
      </section>

      {/* Monthly chart */}
      <Card title="المبيعات وصافي الربح — آخر 12 شهراً" className="mt-6">
        {isLoading ? <Skeleton className="h-72" /> : d && <MonthlyChart data={d.monthly} />}
      </Card>

      {d && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TopProducts d={d} />
            <Card title="المبيعات حسب المنطقة" subtitle="الطلبات المسلّمة في الفترة">
              <RankedBars
                rows={d.sales_by_area}
                value={(r) => r.revenue}
                format={money}
                label={(r) => r.area}
                sub={(r) => `${r.orders} طلب`}
              />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card
              title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> مخزون منخفض</span>}
              subtitle="المخزون ≤ حد إعادة الطلب"
              actions={<Link to="/products?low_stock=1" className="text-xs font-semibold text-brand-700">عرض الكل</Link>}
              bodyClassName="p-0"
            >
              <SimpleTable
                rows={d.low_stock}
                empty="لا توجد منتجات منخفضة المخزون 👍"
                cols={[
                  ['المنتج', (r) => <span className="font-semibold">{r.name}</span>],
                  ['المتوفر', (r) => (r.stock <= 0 ? <Badge tone="red">نفد</Badge> : <Badge tone="amber">{r.stock}</Badge>)],
                  ['حد الطلب', (r) => r.reorder_level],
                ]}
              />
            </Card>
            <Card title="مخزون راكد" subtitle="في المخزون ولم يُبع منذ 60 يوماً" bodyClassName="p-0">
              <SimpleTable
                rows={d.dead_stock}
                empty="لا يوجد مخزون راكد"
                cols={[
                  ['المنتج', (r) => <span className="font-semibold">{r.name}</span>],
                  ['الكمية', (r) => r.stock],
                  ['القيمة', (r) => <Money value={r.stock_value} />],
                  ['آخر بيع', (r) => (r.last_sold_at ? date(r.last_sold_at) : 'لم يُبع')],
                ]}
              />
            </Card>
          </div>

          <Card title="أفضل الزبائن المتكررين" subtitle="حسب رقم الهاتف — كل الفترات" className="mt-4" bodyClassName="p-0">
            <SimpleTable
              rows={d.top_customers}
              empty="لا يوجد زبائن متكررون بعد"
              cols={[
                ['الزبون', (r) => <div><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-500" dir="ltr">{r.phone}</div></div>],
                ['المنطقة', (r) => r.area ?? '—'],
                ['الطلبات', (r) => <b>{r.orders}</b>],
                ['الإجمالي', (r) => <Money value={r.total} />],
                ['آخر طلب', (r) => date(r.last_order)],
              ]}
            />
          </Card>

          {/* Personal delivery income — deliberately separate from store figures */}
          <section className="mt-6 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Bike className="size-5 text-violet-700" />
              <h2 className="font-bold text-slate-900">أرباح التوصيل الشخصية — هذا الشهر</h2>
              <Badge tone="slate">دخل شخصي · ليس من إيرادات المتجر</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {d.delivery_earnings.rows.map((r) => (
                <div key={r.user_id} className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                  <div className="text-sm font-semibold text-slate-600">{r.name}</div>
                  <Money value={r.earnings} className="mt-1 block text-lg font-bold text-slate-900" />
                  <div className="text-xs text-slate-500">{r.deliveries} توصيلة</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              سعر التوصيل يخص من قام بالتوصيل شخصياً، ولا يدخل في الإيرادات أو الأرباح أو العهدة. تكاليف البنزين ليست مصروفات للمتجر.
            </p>
          </section>
        </>
      )}
    </>
  )
}

function CustodyCard({ c }) {
  const owed = c.balance < 0
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${owed ? 'bg-rose-50 ring-rose-200' : 'bg-white ring-slate-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-600">عهدة {c.name}</div>
          <Money value={c.balance} className={`mt-1 block text-2xl font-bold ${owed ? 'text-rose-700' : 'text-slate-900'}`} />
        </div>
        {owed ? (
          <Badge tone="red"><AlertTriangle className="size-3" /> المتجر مدين له</Badge>
        ) : (
          <Badge tone="green">بحوزته نقداً</Badge>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-200/70 pt-3 text-xs">
        <Item label="+ حصّل من الطلبات" value={c.collected} />
        <Item label="− دفع مشتريات" value={c.purchases_paid} />
        <Item label="− دفع مصروفات" value={c.expenses_paid} />
        <Item label="− سلّم للصندوق" value={c.handed_over} />
      </dl>
    </div>
  )
}

function Item({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd><Money value={value} className="font-semibold text-slate-800" /></dd>
    </div>
  )
}

function TopProducts({ d }) {
  const [by, setBy] = useState('qty')
  const rows = by === 'qty' ? d.top_products_by_qty : d.top_products_by_profit

  return (
    <Card
      title="أفضل 10 منتجات"
      subtitle="الطلبات المسلّمة في الفترة"
      actions={
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {[['qty', 'بالكمية'], ['profit', 'بالربح']].map(([k, l]) => (
            <button key={k} onClick={() => setBy(k)} className={`rounded-md px-2.5 py-1 ${by === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      }
    >
      <RankedBars
        rows={rows}
        value={(r) => (by === 'qty' ? r.qty : r.profit)}
        format={by === 'qty' ? (v) => `${num(v)} قطعة` : money}
        label={(r) => r.name}
        sub={(r) => (by === 'qty' ? `ربح ${money(r.profit)}` : `${num(r.qty)} قطعة · مبيعات ${money(r.revenue)}`)}
      />
    </Card>
  )
}

/** Table on md+; stacked cards on phones so no column is clipped. */
function SimpleTable({ rows, cols, empty }) {
  if (!rows?.length) return <p className="px-4 py-8 text-center text-sm text-slate-500">{empty}</p>
  const [[, renderTitle], ...rest] = cols
  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((r, i) => (
          <li key={i} className="px-4 py-3 text-sm">
            <div className="text-slate-900">{renderTitle(r)}</div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {rest.map(([h, render]) => (
                <div key={h} className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">{h}</dt>
                  <dd className="text-slate-800">{render(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr>{cols.map(([h]) => <th key={h} className="whitespace-nowrap px-4 py-2 text-start font-bold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>{cols.map(([h, render]) => <td key={h} className="whitespace-nowrap px-4 py-2.5 text-slate-700">{render(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
