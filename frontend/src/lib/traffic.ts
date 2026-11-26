import type { Locale } from '@/i18n/use-language'
import type { TrafficStatus } from '@/types/traffic'

/** Thang màu bắt buộc theo Agents.md §7 */
export const STATUS_META = {
  CLEAR: { color: 'var(--traffic-clear)' },
  MODERATE: { color: 'var(--traffic-moderate)' },
  CONGESTED: { color: 'var(--traffic-congested)' },
  UNKNOWN: { color: 'var(--traffic-unknown)' },
} satisfies Record<TrafficStatus, { color: string }>

export function statusFromRatio(ratio: number): TrafficStatus {
  if (ratio >= 0.75) return 'CLEAR'
  if (ratio >= 0.45) return 'MODERATE'
  return 'CONGESTED'
}

export const pct = (value: number): string => `${Math.round(value * 100)}%`

export const formatSpeed = (value: number, locale: Locale): string =>
  value.toLocaleString(locale, { maximumFractionDigits: 1 })

export const formatClock = (value: string | number, locale: Locale): string =>
  new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

export const formatDateTime = (iso: string, locale: Locale): string =>
  new Date(iso).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

const relativeTime = {
  'vi-VN': new Intl.RelativeTimeFormat('vi-VN', { numeric: 'always' }),
  'en-US': new Intl.RelativeTimeFormat('en-US', { numeric: 'always' }),
}

export function timeAgo(iso: string, locale: Locale): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  const formatter = relativeTime[locale]
  if (seconds < 60) return formatter.format(-seconds, 'second')
  if (seconds < 3600) return formatter.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86_400) return formatter.format(-Math.floor(seconds / 3600), 'hour')
  return formatter.format(-Math.floor(seconds / 86_400), 'day')
}
