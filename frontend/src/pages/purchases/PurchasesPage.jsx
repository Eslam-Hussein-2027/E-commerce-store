import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { useList, useProductOptions } from '@/lib/queries'
import { useUrlFilters } from '@/lib/useUrlFilters'
import { date, money } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Money from '@/components/ui/Money'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import FilterBar from '@/components/ui/FilterBar'
import DateRangeInputs from '@/components/ui/DateRangeInputs'
import { Select } from '@/components/ui/FormField'
import UserSelect from '@/components/UserSelect'

export default function PurchasesPage() {
  const navigate = useNavigate()
  const { filters, setFilter, setPage } = useUrlFilters()
  const { data, isLoading, isFetching } = useList('purchases', filters)
  const { data: products } = useProductOptions()

  return (
    <>
      <PageHeader
        title="المشتريات"
        subtitle={data?.summary && `إجمالي حسب الفلتر: ${money(data.summary.total_cost)}`}
        actions={<Button icon={Plus} onClick={() => navigate('/purchases/new')}>فاتورة شراء</Button>}
      />
      <FilterBar>
        <SearchInput className="col-span-2 sm:!w-60" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="المورد أو رقم الفاتورة…" />
        <DateRangeInputs filters={filters} setFilter={setFilter} />
        <Select value={filters.product_id ?? ''} onChange={(e) => setFilter('product_id', e.target.value)} className="self-end">
          <option value="">كل المنتجات</option>
          {products?.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <UserSelect placeholder="كل الدافعين" value={filters.user_id ?? ''} onChange={(e) => setFilter('user_id', e.target.value)} className="self-end" />
      </FilterBar>
      <Table
        loading={isLoading || isFetching}
        rows={data?.data}
        onRowClick={(p) => navigate(`/purchases/${p.id}`)}
        empty="لا توجد فواتير شراء"
        columns={[
          { key: 'id', header: '#', mobile: 'hidden', render: (p) => <span className="font-bold">#{p.id}</span> },
          { key: 'supplier', header: 'المورد', mobile: 'title', render: (p) => <span className="font-semibold text-slate-900">{p.supplier || 'بدون مورد'} <span className="text-xs font-normal text-slate-400 md:hidden">#{p.id}</span></span> },
          { key: 'items', header: 'الأصناف', mobile: 'subtitle', render: (p) => <span className="block max-w-64 truncate text-xs">{p.items?.map((i) => `${i.product?.name} ×${i.qty}`).join('، ')}</span> },
          { key: 'total_cost', header: 'الإجمالي', mobile: 'value', render: (p) => <Money value={p.total_cost} className="font-semibold" /> },
          { key: 'date', header: 'التاريخ', mobile: 'line', render: (p) => date(p.purchase_date) },
          { key: 'paid_by', header: 'دفعها', mobile: 'line', render: (p) => p.paid_by?.name ?? 'رأس المال / الصندوق' },
        ]}
      />
      <Pagination meta={data?.meta} onPage={setPage} />
    </>
  )
}
