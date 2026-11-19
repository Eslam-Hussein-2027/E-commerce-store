import {
  ClipboardList, HandCoins, History, KeyRound, LayoutDashboard, Package, PackageMinus, Receipt, ShoppingCart, Tags, Truck, Users,
} from 'lucide-react'

export const NAV = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, end: true, primary: true },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart, primary: true },
  { to: '/products', label: 'المنتجات', icon: Package, primary: true },
  { to: '/purchases', label: 'المشتريات', icon: Truck, primary: true },
  { to: '/categories', label: 'التصنيفات', icon: Tags },
  { to: '/expenses', label: 'المصروفات', icon: Receipt },
  { to: '/handovers', label: 'تسليم النقدية', icon: HandCoins },
  { to: '/partners', label: 'الشركاء', icon: Users },
  { to: '/adjustments', label: 'تسويات المخزون', icon: PackageMinus },
  { to: '/movements', label: 'سجل حركة المخزون', icon: History },
  { to: '/account', label: 'الحساب', icon: KeyRound },
]

export const MORE_ICON = ClipboardList
