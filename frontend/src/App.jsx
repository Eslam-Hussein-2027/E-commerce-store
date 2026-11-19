import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Loader2 } from 'lucide-react'
import RequireAuth from './auth/RequireAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage'))
const OrderFormPage = lazy(() => import('./pages/orders/OrderFormPage'))
const OrderDetailsPage = lazy(() => import('./pages/orders/OrderDetailsPage'))
const ProductsPage = lazy(() => import('./pages/products/ProductsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const PurchasesPage = lazy(() => import('./pages/purchases/PurchasesPage'))
const PurchaseFormPage = lazy(() => import('./pages/purchases/PurchaseFormPage'))
const PurchaseDetailsPage = lazy(() => import('./pages/purchases/PurchaseDetailsPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const AdjustmentsPage = lazy(() => import('./pages/AdjustmentsPage'))
const HandoversPage = lazy(() => import('./pages/HandoversPage'))
const MovementsPage = lazy(() => import('./pages/MovementsPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const PageLoader = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="size-7 animate-spin text-brand-700" />
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route
          element={
            <Suspense fallback={<PageLoader />}>
              <Layout />
            </Suspense>
          }
        >
          <Route index element={<Lazy><DashboardPage /></Lazy>} />
          <Route path="orders" element={<Lazy><OrdersPage /></Lazy>} />
          <Route path="orders/new" element={<Lazy><OrderFormPage /></Lazy>} />
          <Route path="orders/:id" element={<Lazy><OrderDetailsPage /></Lazy>} />
          <Route path="orders/:id/edit" element={<Lazy><OrderFormPage /></Lazy>} />
          <Route path="products" element={<Lazy><ProductsPage /></Lazy>} />
          <Route path="categories" element={<Lazy><CategoriesPage /></Lazy>} />
          <Route path="purchases" element={<Lazy><PurchasesPage /></Lazy>} />
          <Route path="purchases/new" element={<Lazy><PurchaseFormPage /></Lazy>} />
          <Route path="purchases/:id" element={<Lazy><PurchaseDetailsPage /></Lazy>} />
          <Route path="expenses" element={<Lazy><ExpensesPage /></Lazy>} />
          <Route path="adjustments" element={<Lazy><AdjustmentsPage /></Lazy>} />
          <Route path="handovers" element={<Lazy><HandoversPage /></Lazy>} />
          <Route path="movements" element={<Lazy><MovementsPage /></Lazy>} />
          <Route path="account" element={<Lazy><AccountPage /></Lazy>} />
          <Route path="*" element={<Lazy><NotFoundPage /></Lazy>} />
        </Route>
      </Route>
    </Routes>
  )
}

function Lazy({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}
