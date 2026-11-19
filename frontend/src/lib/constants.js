export const ORDER_STATUSES = {
  pending: { label: 'قيد التجهيز', badge: 'bg-amber-100 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  out_for_delivery: { label: 'خرج للتوصيل', badge: 'bg-sky-100 text-sky-800 ring-sky-600/20', dot: 'bg-sky-500' },
  delivered: { label: 'تم التسليم', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20', dot: 'bg-emerald-500' },
  cancelled: { label: 'ملغي', badge: 'bg-slate-200 text-slate-700 ring-slate-500/20', dot: 'bg-slate-400' },
  returned: { label: 'مرتجع', badge: 'bg-rose-100 text-rose-800 ring-rose-600/20', dot: 'bg-rose-500' },
}

/** Action buttons shown for each target status. */
export const STATUS_ACTIONS = {
  out_for_delivery: { label: 'خرج للتوصيل', tone: 'sky' },
  delivered: { label: 'تم التسليم', tone: 'emerald' },
  cancelled: { label: 'إلغاء', tone: 'slate' },
  returned: { label: 'مرتجع', tone: 'rose' },
  pending: { label: 'إرجاع للتجهيز', tone: 'amber' },
}

export const EXPENSE_CATEGORIES = { ads: 'إعلانات', packaging: 'تغليف', other: 'أخرى' }

export const ADJUSTMENT_REASONS = { damaged: 'تالف', lost: 'مفقود', count_correction: 'تصحيح جرد' }

export const MOVEMENT_TYPES = {
  in: { label: 'وارد (شراء)', className: 'text-emerald-700 bg-emerald-50' },
  out: { label: 'صادر (بيع)', className: 'text-sky-700 bg-sky-50' },
  return: { label: 'مرتجع للمخزون', className: 'text-amber-700 bg-amber-50' },
  adjustment: { label: 'تسوية', className: 'text-rose-700 bg-rose-50' },
}

export const LIBYAN_AREAS = [
  'طرابلس', 'تاجوراء', 'جنزور', 'سوق الجمعة', 'عين زارة', 'قصر بن غشير', 'الزاوية', 'مصراتة',
  'بنغازي', 'الخمس', 'زليتن', 'غريان', 'صبراتة', 'سرت', 'البيضاء', 'طبرق', 'سبها',
]
