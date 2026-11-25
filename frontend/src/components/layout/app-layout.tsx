import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Cpu, Home, Map, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Trang chủ', icon: Home, end: true, id: 'nav-home' },
  { to: '/dashboard', label: 'Dự báo giao thông', icon: Map, end: false, id: 'nav-dashboard' },
  { to: '/edge-nodes', label: 'Edge Nodes', icon: Cpu, end: false, id: 'nav-edge-nodes' },
]

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const fullBleed = pathname === '/dashboard'

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-[1000] border-b border-white/5 bg-ink-950/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <Link to="/" id="nav-logo" className="group flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-clear shadow-[0_0_20px_rgb(34_211_238/0.4)] transition-transform group-hover:rotate-6">
              <Activity className="size-5 text-ink-950" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              bk<span className="text-brand">traffic</span>
            </span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end, id }) => (
              <li key={to}>
                <NavLink
                  id={id}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="hidden text-xs text-muted-foreground md:block">
            LSTM-FedProx
          </div>

          <Button
            id="nav-mobile-toggle"
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </nav>

        {open && (
          <ul className="space-y-1 border-t border-white/5 px-4 py-3 md:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', isActive ? 'bg-white/10 text-white' : 'text-muted-foreground')
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </header>

      <main className={cn('flex-1', !fullBleed && 'mx-auto w-full max-w-[1600px] px-4 sm:px-6')}>
        <Outlet />
      </main>

      {!fullBleed && (
        <footer className="border-t border-white/5 py-6 text-center text-xs text-muted-foreground">
          bktraffic · Federated LSTM-FedProx · Node-Agent Architecture · Bản đồ © OpenStreetMap · Routing © OSRM
        </footer>
      )}
    </div>
  )
}
