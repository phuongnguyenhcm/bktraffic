import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage, type Language } from '@/i18n/use-language'

const OPTIONS = {
  vi: { code: 'VI', label: 'Tiếng Việt' },
  en: { code: 'EN', label: 'English' },
} satisfies Record<Language, { code: string; label: string }>

export default function LanguageSwitcher() {
  const { language, setLanguage, messages } = useLanguage()
  const label = messages.nav.switchLanguage

  return (
    <Menu.Root>
      <Menu.Trigger
        render={<Button type="button" variant="outline" className="h-9 gap-1 rounded-full px-2 text-xs" />}
        aria-label={`${label} (${OPTIONS[language].label})`}
        title={label}
      >
        <span className="font-semibold">{OPTIONS[language].code}</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-[1100]">
          <Menu.Popup aria-label={label} className="min-w-36 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-panel">
            <Menu.RadioGroup value={language} onValueChange={(value: unknown) => {
              if (value === 'vi' || value === 'en') setLanguage(value)
            }}>
              {Object.entries(OPTIONS).map(([value, option]) => (
                <Menu.RadioItem key={value} value={value} lang={value} closeOnClick
                  className="flex cursor-default items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground">
                  {option.label}
                  <Menu.RadioItemIndicator><Check className="size-4 text-primary" aria-hidden /></Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
