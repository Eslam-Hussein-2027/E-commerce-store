import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-slate-600">الصفحة غير موجودة</p>
      <Link to="/" className="mt-4 inline-block font-semibold text-brand-700">العودة للرئيسية</Link>
    </div>
  )
}
