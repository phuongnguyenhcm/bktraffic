import { Tooltip } from '@base-ui/react/tooltip'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'
  const label = dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<Button type="button" variant="outline" size="icon-lg" className="relative rounded-full" />}
        aria-label={label}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        <Sun aria-hidden className="absolute size-[18px] scale-100 rotate-0 text-amber-600 opacity-100 motion-safe:transition motion-safe:duration-200 dark:scale-50 dark:-rotate-45 dark:opacity-0" />
        <Moon aria-hidden className="absolute size-[18px] scale-50 rotate-45 text-primary opacity-0 motion-safe:transition motion-safe:duration-200 dark:scale-100 dark:rotate-0 dark:opacity-100" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" align="end" sideOffset={8} className="z-[1100]">
          <Tooltip.Popup className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-panel">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
