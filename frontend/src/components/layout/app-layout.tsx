import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Cpu, Home, Map, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeSwitcher from '@/components/theme-switcher'
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
      <header className="sticky top-0 z-[1000] border-b border-border bg-background/95 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <Link to="/" id="nav-logo" className="group flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary shadow-panel transition-transform group-hover:rotate-6">
              <Activity className="size-5 text-primary-foreground" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">
              bk<span className="text-primary">traffic</span>
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
                      isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-muted-foreground lg:inline">LSTM-FedProx</span>
            <ThemeSwitcher />
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
          </div>
        </nav>

        {open && (
          <ul className="space-y-1 border-t border-border px-4 py-3 md:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', isActive ? 'bg-accent text-foreground' : 'text-muted-foreground')
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
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          bktraffic · Federated LSTM-FedProx · Node-Agent Architecture · Bản đồ © OpenStreetMap và CARTO · Routing © OSRM
        </footer>
      )}
    </div>
  )
}
