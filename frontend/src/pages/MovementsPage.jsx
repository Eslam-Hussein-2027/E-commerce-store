import { Link } from 'react-router'
import { useList, useProductOptions } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { dateTime } from '@/lib/format'
import { MOVEMENT_TYPES } from '@/lib/constants'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import FilterBar from '@/components/ui/FilterBar'
import DateRangeInputs from '@/components/ui/DateRangeInputs'
import { Select } from '@/components/ui/FormField'
import UserSelect from '@/components/UserSelect'

const refLink = (m) => {
  if (m.reference_type === 'order') return `/orders/${m.reference_id}`
  if (m.reference_type === 'purchase') return `/purchases/${m.reference_id}`
  if (m.reference_type === 'adjustment') return `/adjustments?product_id=${m.product_id}`
  return null
}

export default function MovementsPage() {
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('stock-movements', filters)
  const { data: products } = useProductOptions()

  const typeChip = (m) => <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${MOVEMENT_TYPES[m.type]?.className}`}>{m.type_label}</span>
  const qty = (m) => <span dir="ltr" className={`font-bold tabular-nums ${m.qty < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
  const ref = (m) => {
    const to = refLink(m)
    return to ? <Link to={to} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-700 hover:underline">{m.reference_label}</Link> : '—'
  }

  return (
    <>
      <PageHeader title="سجل حركة المخزون" subtitle="سجل للقراءة فقط — المخزون الحالي = مجموع هذه الحركات" />
      <FilterBar>
        <Select value={filters.product_id ?? ''} onChange={(e) => setFilter('product_id', e.target.value)} className="col-span-2 self-end">
          <option value="">كل المنتجات</option>
          {products?.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filters.type ?? ''} onChange={(e) => setFilter('type', e.target.value)} className="self-end">
          <option value="">كل الأنواع</option>
          {Object.entries(MOVEMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <UserSelect placeholder="كل المستخدمين" value={filters.user_id ?? ''} onChange={(e) => setFilter('user_id', e.target.value)} className="self-end" />
        <DateRangeInputs filters={filters} setFilter={setFilter} />
      </FilterBar>
      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        empty="لا توجد حركات"
        columns={[
          { key: 'date', header: 'التاريخ', render: (m) => dateTime(m.created_at) },
          { key: 'product', header: 'المنتج', render: (m) => <span className="font-semibold text-slate-900">{m.product?.name}</span> },
          { key: 'type', header: 'النوع', render: typeChip },
          { key: 'qty', header: 'الكمية', render: qty },
          { key: 'after', header: 'الرصيد بعدها', render: (m) => <span className="tabular-nums">{m.stock_after}</span> },
          { key: 'ref', header: 'المرجع', render: ref },
          { key: 'note', header: 'ملاحظة', render: (m) => m.note || '—', className: 'max-w-xs truncate' },
          { key: 'by', header: 'بواسطة', render: (m) => m.created_by_name ?? '—' },
        ]}
        mobileCard={(m) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{m.product?.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">{typeChip(m)} {ref(m)}</div>
              </div>
              <div className="text-end">
                <div className="text-lg">{qty(m)}</div>
                <div className="text-xs text-slate-500">الرصيد {m.stock_after}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">{dateTime(m.created_at)} · {m.created_by_name}</div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />
    </>
  )
}
