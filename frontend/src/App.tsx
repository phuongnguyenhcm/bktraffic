import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from '@/components/layout/app-layout'
import LandingPage from '@/pages/landing-page'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/i18n/use-language'

const DashboardPage = lazy(() => import('@/pages/dashboard-page'))
const EdgeNodesPage = lazy(() => import('@/pages/edge-nodes-page'))
const EdgeSetupPage = lazy(() => import('@/pages/edge-setup-page'))

const TITLE_KEYS = new Map<string, 'dashboard' | 'agents' | 'setup'>([
  ['/dashboard', 'dashboard'],
  ['/edge-nodes', 'agents'],
  ['/edge-nodes/setup', 'setup'],
])

export default function App() {
  const { pathname } = useLocation()
  const { messages } = useLanguage()
  useEffect(() => {
    document.title = messages.meta[TITLE_KEYS.get(pathname) ?? 'home']
    document.querySelector('meta[name="description"]')?.setAttribute('content', messages.meta.description)
  }, [messages, pathname])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Suspense fallback={<PageLoading />}><DashboardPage /></Suspense>} />
        <Route path="/edge-nodes" element={<Suspense fallback={<PageLoading />}><EdgeNodesPage /></Suspense>} />
        <Route path="/edge-nodes/setup" element={<Suspense fallback={<PageLoading />}><EdgeSetupPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function PageLoading() {
  const { messages } = useLanguage()
  return (
    <div role="status" aria-label={messages.common.loadingPage} className="space-y-4 py-8">
      <Skeleton className="h-9 w-60" />
      <Skeleton className="h-[55vh] w-full" />
    </div>
  )
}
