/**
 * Colores de estado para signos vitales.
 * El icono y el valor comparten la misma paleta: verde, amarillo, rojo o gris.
 */

import { Colors } from '@constants/colors'
import { VITAL_META, type VitalType } from '@hooks/useVitals'

export type VitalStatus = 'success' | 'warning' | 'error' | 'muted'

export interface StatusBadge {
  color: string
  bg:    string
}

const STATUS_BADGE: Record<VitalStatus, StatusBadge> = {
  success: { color: Colors.semantic.success, bg: Colors.semantic.successBg },
  warning: { color: Colors.semantic.warning, bg: Colors.semantic.warningBg },
  error:   { color: Colors.semantic.error,   bg: Colors.semantic.errorBg },
  muted:   { color: Colors.light.textMuted,  bg: '#F1F5F9' },
}

export function getStatusBadge(status: VitalStatus): StatusBadge {
  return STATUS_BADGE[status]
}

export function getStatusColor(status: VitalStatus): string {
  return STATUS_BADGE[status].color
}

function evaluateRange(value: number, min: number, max: number): VitalStatus {
  if (value < min || value > max) return 'error'
  const margin = (max - min) * 0.1
  if (value < min + margin || value > max - margin) return 'warning'
  return 'success'
}

function worstStatus(...statuses: VitalStatus[]): VitalStatus {
  const rank: Record<VitalStatus, number> = { muted: 0, success: 1, warning: 2, error: 3 }
  return statuses.reduce((w, s) => (rank[s] > rank[w] ? s : w), 'muted')
}

export function getVitalStatus(
  type: VitalType,
  value?: number | null,
  secondaryValue?: number | null,
): VitalStatus {
  if (value == null || Number.isNaN(value)) return 'muted'
  const meta = VITAL_META[type]
  if (!meta) return 'muted'

  const primary = evaluateRange(value, meta.normal.min, meta.normal.max)

  if (type === 'BLOOD_PRESSURE' && secondaryValue != null && !Number.isNaN(secondaryValue)) {
    return worstStatus(primary, evaluateRange(secondaryValue, 60, 90))
  }
  return primary
}

export function getBmiStatus(bmi: number | null): VitalStatus {
  if (bmi == null) return 'muted'
  if (bmi < 18.5) return 'warning'
  if (bmi < 25)   return 'success'
  if (bmi < 30)   return 'warning'
  return 'error'
}
