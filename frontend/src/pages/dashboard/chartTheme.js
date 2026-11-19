// Validated categorical slots (dataviz reference palette, light surface).
// Fixed order: slot 1 = revenue, slot 2 = net profit. Single-series charts use slot 1 only.
export const SERIES = {
  1: '#2a78d6',
  2: '#eb6834',
}

export const AXIS = { tick: '#64748b', grid: '#e2e8f0' }

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
export const compactNum = (v) => compact.format(v)
