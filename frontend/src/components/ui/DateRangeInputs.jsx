import { Input } from './FormField'

/** Two date inputs bound to ?from= & ?to= filters. */
export default function DateRangeInputs({ filters, setFilter }) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">من تاريخ</span>
        <Input type="date" value={filters.from ?? ''} onChange={(e) => setFilter('from', e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">إلى تاريخ</span>
        <Input type="date" value={filters.to ?? ''} onChange={(e) => setFilter('to', e.target.value)} />
      </label>
    </>
  )
}
