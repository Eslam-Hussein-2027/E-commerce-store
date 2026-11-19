import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Plus } from 'lucide-react'
import { useList } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { money, num } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Money from '@/components/ui/Money'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import FilterBar from '@/components/ui/FilterBar'
import { Select } from '@/components/ui/FormField'
import ProductFormModal from './ProductFormModal'

export default function ProductsPage() {
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('products', filters)
  const { data: categories } = useList('categories', { all: 1 })
  const [editing, setEditing] = useState(null)

  const stockBadge = (p) =>
    p.stock <= 0 ? <Badge tone="red">نفد</Badge> : p.is_low_stock ? <Badge tone="amber"><AlertTriangle className="size-3" /> منخفض</Badge> : null

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle={data?.summary && `قيمة المخزون: ${money(data.summary.stock_value)} · ${data.summary.low_stock_count} منتج منخفض المخزون`}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>منتج جديد</Button>}
      />

      <FilterBar>
        <SearchInput className="col-span-2 sm:!w-64" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="ابحث بالاسم أو الرمز…" />
        <Select value={filters.category_id ?? ''} onChange={(e) => setFilter('category_id', e.target.value)}>
          <option value="">كل التصنيفات</option>
          {categories?.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={filters.active ?? ''} onChange={(e) => setFilter('active', e.target.value)}>
          <option value="">نشط وغير نشط</option>
          <option value="1">النشطة فقط</option>
          <option value="0">غير النشطة</option>
        </Select>
        <label className="col-span-2 flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-300 sm:col-span-1">
          <input type="checkbox" className="size-4 accent-brand-700" checked={filters.low_stock === '1'} onChange={(e) => setFilter('low_stock', e.target.checked ? '1' : '')} />
          المخزون المنخفض فقط
        </label>
      </FilterBar>

      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        onRowClick={setEditing}
        empty="لا توجد منتجات مطابقة"
        columns={[
          {
            key: 'name', header: 'المنتج',
            render: (p) => (
              <div>
                <div className={`font-semibold ${p.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{p.name}</div>
                <div className="text-xs text-slate-500" dir="ltr">{p.sku}</div>
              </div>
            ),
          },
          { key: 'category', header: 'التصنيف', render: (p) => p.category?.name ?? '—' },
          { key: 'sell_price', header: 'سعر البيع', render: (p) => <Money value={p.sell_price} /> },
          {
            key: 'stock', header: 'المخزون',
            render: (p) => <div className="flex items-center gap-2"><span className="font-bold tabular-nums">{num(p.stock)}</span>{stockBadge(p)}</div>,
          },
          { key: 'avg_cost', header: 'متوسط التكلفة', render: (p) => <Money value={p.avg_cost} /> },
          { key: 'stock_value', header: 'قيمة المخزون', render: (p) => <Money value={p.stock_value} className="font-semibold" /> },
          { key: 'is_active', header: 'الحالة', render: (p) => (p.is_active ? <Badge tone="green">نشط</Badge> : <Badge>متوقف</Badge>) },
          {
            key: 'log', header: '',
            render: (p) => (
              <Link to={`/movements?product_id=${p.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-brand-700 hover:underline">
                سجل الحركة
              </Link>
            ),
          },
        ]}
        mobileCard={(p) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`truncate font-semibold ${p.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{p.name}</div>
                <div className="text-xs text-slate-500">
                  <span dir="ltr">{p.sku}</span>
                  {p.category && ` · ${p.category.name}`}
                </div>
              </div>
              <div className="text-end">
                <div className="text-lg font-bold tabular-nums text-slate-900">{num(p.stock)}</div>
                {stockBadge(p)}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div><div className="text-slate-500">البيع</div><Money value={p.sell_price} className="font-semibold" /></div>
              <div><div className="text-slate-500">متوسط التكلفة</div><Money value={p.avg_cost} className="font-semibold" /></div>
              <div><div className="text-slate-500">قيمة المخزون</div><Money value={p.stock_value} className="font-semibold" /></div>
            </div>
          </div>
        )}
      />
      <Pagination meta={data?.meta} onPage={setPage} />

      {editing && <ProductFormModal product={editing} categories={categories?.data ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
