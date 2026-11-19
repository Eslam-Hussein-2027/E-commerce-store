import { useNavigate } from 'react-router'
import { MapPin, Phone, Plus } from 'lucide-react'
import { useList } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { date } from '@/lib/format'
import { ORDER_STATUSES } from '@/lib/constants'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import DateRangeInputs from '@/components/ui/DateRangeInputs'
import UserSelect from '@/components/UserSelect'
import OrderStatusActions from './OrderStatusActions'

const itemsSummary = (o) => o.items?.map((i) => `${i.product?.name} ×${i.qty}`).join('، ')

export default function OrdersPage() {
  const navigate = useNavigate()
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('orders', filters)
  const counts = data?.summary?.by_status ?? {}
  const total = Object.values(counts).reduce((a, b) => a + Number(b), 0)

  const tabs = [['', 'الكل', total], ...Object.entries(ORDER_STATUSES).map(([k, v]) => [k, v.label, counts[k] ?? 0])]

  return (
    <>
      <PageHeader
        title="الطلبات"
        actions={<Button icon={Plus} onClick={() => navigate('/orders/new')}>طلب جديد</Button>}
      />

      {/* Status tabs */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map(([key, label, count]) => {
          const active = (filters.status ?? '') === key
          return (
            <button
              key={key || 'all'}
              onClick={() => setFilter('status', key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
            >
              {label}
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <SearchInput className="col-span-2 sm:w-72" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="اسم، هاتف، منطقة أو رقم الطلب…" />
        <details className="col-span-2 sm:contents" open={!!(filters.from || filters.to || filters.user_id)}>
          <summary className="cursor-pointer select-none py-1 text-sm font-semibold text-brand-700 sm:hidden">فلاتر إضافية</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-0 sm:contents [&>*]:sm:w-44">
            <DateRangeInputs filters={filters} setFilter={setFilter} />
            <UserSelect placeholder="كل الموصّلين" value={filters.user_id ?? ''} onChange={(e) => setFilter('user_id', e.target.value)} className="col-span-2 self-end" />
          </div>
        </details>
      </div>

      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        empty="لا توجد طلبات مطابقة"
        columns={[
          { key: 'id', header: '#', render: (o) => <span className="font-bold text-slate-900">#{o.id}</span> },
          {
            key: 'customer', header: 'الزبون',
            render: (o) => (
              <div>
                <div className="font-semibold text-slate-900">{o.customer_name}</div>
                <div className="text-xs text-slate-500" dir="ltr">{o.phone}</div>
              </div>
            ),
          },
          { key: 'area', header: 'المنطقة', render: (o) => o.area || '—' },
          { key: 'items', header: 'الأصناف', render: (o) => <span className="block max-w-56 truncate text-xs">{itemsSummary(o)}</span> },
          { key: 'goods_total', header: 'قيمة البضاعة', render: (o) => <Money value={o.goods_total} className="font-semibold" /> },
          { key: 'status', header: 'الحالة', render: (o) => <StatusBadge status={o.status} /> },
          { key: 'date', header: 'التاريخ', render: (o) => date(o.order_date) },
          { key: 'actions', header: '', render: (o) => <OrderStatusActions order={o} /> },
        ]}
        mobileCard={(o) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{o.id}</span>
                  <span className="truncate font-semibold text-slate-900">{o.customer_name}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                  <a href={`tel:${o.phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1" dir="ltr">
                    <Phone className="size-3" />{o.phone}
                  </a>
                  {o.area && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{o.area}</span>}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <Money value={o.goods_total} className="font-bold text-slate-900" />
                <div className="mt-1"><StatusBadge status={o.status} /></div>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-slate-600">{itemsSummary(o)}</p>
            <div className="mt-1 text-[11px] text-slate-400">
              {date(o.order_date)}{o.delivered_by && ` · التوصيل: ${o.delivered_by.name}`}
            </div>
            <OrderStatusActions order={o} className="mt-3 border-t border-slate-100 pt-3" />
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

    </>
  )
}
