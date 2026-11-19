import { ListSkeleton } from './Skeleton'
import EmptyState from './EmptyState'

/**
 * Responsive table: a real <table> on md+ screens, a card list on phones.
 *
 * columns: [{ key, header, render?(row), className?, mobile?: 'title' | 'subtitle' | 'value' | 'hidden' | 'line' }]
 *   - title/subtitle/value build the default phone card; 'line' shows "header: value" rows under it.
 * mobileCard?(row): fully custom phone card.
 */
export default function Table({ columns, rows, loading, rowKey = 'id', onRowClick, mobileCard, empty, footer }) {
  if (loading && !rows) return <ListSkeleton />
  if (!rows?.length) return <EmptyState text={empty} />

  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])

  return (
    <div className={loading ? 'opacity-60 transition' : 'transition'}>
      {/* Phones */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row[rowKey]}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
          >
            {mobileCard ? mobileCard(row) : <DefaultCard columns={columns} row={row} cell={cell} />}
          </li>
        ))}
      </ul>

      {/* Tablets / desktop */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={`whitespace-nowrap px-4 py-3 text-start text-xs font-bold text-slate-500 ${col.className ?? ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`whitespace-nowrap px-4 py-3 text-slate-700 ${col.className ?? ''}`}>
                      {cell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && <tfoot className="bg-slate-50/80">{footer}</tfoot>}
          </table>
        </div>
      </div>
    </div>
  )
}

function DefaultCard({ columns, row, cell }) {
  const pick = (role) => columns.find((c) => c.mobile === role)
  const title = pick('title') ?? columns[0]
  const subtitle = pick('subtitle')
  const value = pick('value')
  const lines = columns.filter((c) => c.mobile === 'line')

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{cell(title, row)}</div>
          {subtitle && <div className="mt-0.5 truncate text-xs text-slate-500">{cell(subtitle, row)}</div>}
        </div>
        {value && <div className="shrink-0 text-sm font-bold text-slate-900">{cell(value, row)}</div>}
      </div>
      {lines.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs">
          {lines.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">{c.header}</dt>
              <dd className="font-medium text-slate-800">{cell(c, row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
