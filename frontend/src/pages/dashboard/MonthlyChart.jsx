import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money, monthLabel } from '@/lib/format'
import { AXIS, SERIES, compactNum } from './chartTheme'

const LEGEND = [
  { key: 'revenue', label: 'المبيعات (الإيرادات)', color: SERIES[1] },
  { key: 'net_profit', label: 'صافي الربح', color: SERIES[2] },
]

/**
 * Revenue and net profit share one unit (د.ل) → one Y axis, grouped bars.
 * RTL: the time axis is reversed so the newest month sits on the left end of reading.
 */
export default function MonthlyChart({ data }) {
  const rows = data.map((m) => ({ ...m, label: monthLabel(m.month) }))

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        {LEGEND.map((l) => (
          <li key={l.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
      </ul>

      <div dir="ltr" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={AXIS.grid} />
            <XAxis dataKey="label" reversed tick={{ fill: AXIS.tick, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={4} />
            <YAxis orientation="right" tickFormatter={compactNum} tick={{ fill: AXIS.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={<MonthTooltip />} />
            <Bar dataKey="revenue" name="المبيعات" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={450} />
            <Bar dataKey="net_profit" name="صافي الربح" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={450} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer select-none font-semibold text-brand-700">عرض البيانات كجدول</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 text-start">الشهر</th>
                <th className="text-start">طلبات</th>
                <th className="text-start">المبيعات</th>
                <th className="text-start">الربح الإجمالي</th>
                <th className="text-start">المصروفات + الخسائر</th>
                <th className="text-start">صافي الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...rows].reverse().map((m) => (
                <tr key={m.month}>
                  <td className="py-1.5 font-semibold">{m.label}</td>
                  <td>{m.orders}</td>
                  <td dir="ltr" className="text-end tabular-nums">{money(m.revenue)}</td>
                  <td dir="ltr" className="text-end tabular-nums">{money(m.gross_profit)}</td>
                  <td dir="ltr" className="text-end tabular-nums">{money(m.expenses + m.stock_losses)}</td>
                  <td dir="ltr" className={`text-end font-semibold tabular-nums ${m.net_profit < 0 ? 'text-rose-600' : ''}`}>{money(m.net_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function MonthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const m = payload[0].payload
  return (
    <div dir="rtl" className="min-w-44 rounded-xl bg-white p-3 text-xs shadow-lg ring-1 ring-slate-200">
      <div className="mb-1.5 font-bold text-slate-900">{m.label}</div>
      <Line color={SERIES[1]} label="المبيعات" value={m.revenue} />
      <Line color={SERIES[2]} label="صافي الربح" value={m.net_profit} />
      <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-slate-500">
        {m.orders} طلب مسلّم · مصروفات {money(m.expenses)}
      </div>
    </div>
  )
}

function Line({ color, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-slate-600">
        <span className="size-2 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span dir="ltr" className="font-semibold tabular-nums text-slate-900">{money(value)}</span>
    </div>
  )
}
