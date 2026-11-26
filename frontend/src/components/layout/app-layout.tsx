import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Cpu, Home, Map, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeSwitcher from '@/components/theme-switcher'
import LanguageSwitcher from '@/components/language-switcher'
import { useLanguage } from '@/i18n/use-language'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'home', icon: Home, end: true, id: 'nav-home' },
  { to: '/dashboard', label: 'traffic', icon: Map, end: false, id: 'nav-dashboard' },
  { to: '/edge-nodes', label: 'agents', icon: Cpu, end: false, id: 'nav-edge-nodes' },
] as const

const CONTAINER = 'mx-auto w-full min-w-0 max-w-[1440px] px-4 sm:px-6 lg:px-8'

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { messages } = useLanguage()

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-[1000] border-b border-border bg-background/95 backdrop-blur-xl">
        <nav className={cn(CONTAINER, 'flex h-16 items-center justify-between')}>
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
                  {messages.nav[label]}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-muted-foreground lg:inline">LSTM-FedProx</span>
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Button
              id="nav-mobile-toggle"
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? messages.nav.closeMenu : messages.nav.openMenu}
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </nav>

        {open && (
          <ul className={cn(CONTAINER, 'space-y-1 border-t border-border py-3 md:hidden')}>
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
                  {messages.nav[label]}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </header>

      <main className={cn(CONTAINER, 'flex-1')}>
        <Outlet />
      </main>

      {pathname !== '/dashboard' && (
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          <p className={CONTAINER}>{messages.nav.footer}</p>
        </footer>
      )}
    </div>
  )
}
