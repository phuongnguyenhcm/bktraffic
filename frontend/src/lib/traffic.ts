import type { PredictionHorizon, TrafficStatus } from '@/types/traffic'

export interface StatusMeta {
  label: string
  shortLabel: string
  color: string
  description: string
}

/** Thang màu bắt buộc theo Agents.md §7 */
export const STATUS_META: Record<TrafficStatus, StatusMeta> = {
  CLEAR: { label: 'Thông thoáng', shortLabel: 'Thông thoáng', color: 'var(--traffic-clear)', description: 'Lưu thông ổn định, gần tốc độ giới hạn.' },
  MODERATE: { label: 'Đông đúc / Di chuyển chậm', shortLabel: 'Đông đúc', color: 'var(--traffic-moderate)', description: 'Mật độ xe cao, tốc độ giảm đáng kể.' },
  CONGESTED: { label: 'Ùn tắc', shortLabel: 'Ùn tắc', color: 'var(--traffic-congested)', description: 'Kẹt xe nghiêm trọng — nên chọn lộ trình khác.' },
  UNKNOWN: { label: 'Chưa có dữ liệu', shortLabel: 'Chưa có dữ liệu', color: 'var(--traffic-unknown)', description: 'Chưa nhận được dự báo còn hiệu lực từ Edge Node.' },
}

export const HORIZON_LABEL: Record<PredictionHorizon, string> = { 5: '5 phút', 10: '10 phút', 30: '30 phút', 60: '1 giờ' }

export function statusFromRatio(ratio: number): TrafficStatus {
  if (ratio >= 0.75) return 'CLEAR'
  if (ratio >= 0.45) return 'MODERATE'
  return 'CONGESTED'
}

export const pct = (v: number): string => `${Math.round(v * 100)}%`
export const formatSpeed = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format

export const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

export function timeAgo(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s trước`
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`
  return `${Math.floor(sec / 3600)} giờ trước`
}
