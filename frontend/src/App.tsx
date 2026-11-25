import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from '@/components/layout/app-layout'
import LandingPage from '@/pages/landing-page'
import { Skeleton } from '@/components/ui/skeleton'

const DashboardPage = lazy(() => import('@/pages/dashboard-page'))
const EdgeNodesPage = lazy(() => import('@/pages/edge-nodes-page'))

const TITLES: Record<string, string> = {
  '/': 'FedTraffic — Dự báo vận tốc giao thông thời gian thực (LSTM-FedProx)',
  '/dashboard': 'Dashboard dự báo giao thông | FedTraffic',
  '/edge-nodes': 'Cổng Edge Node & Cấu hình Agent | FedTraffic',
}

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = TITLES[pathname] ?? TITLES['/']
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Suspense fallback={<PageLoading />}><DashboardPage /></Suspense>} />
        <Route path="/edge-nodes" element={<Suspense fallback={<PageLoading />}><EdgeNodesPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function PageLoading() {
  return (
    <div role="status" aria-label="Đang tải trang" className="mx-auto max-w-[1600px] space-y-4 px-4 py-8">
      <Skeleton className="h-9 w-60" />
      <Skeleton className="h-[55vh] w-full" />
    </div>
  )
}
