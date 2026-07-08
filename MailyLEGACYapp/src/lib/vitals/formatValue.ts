import type { VitalType } from '@hooks/useVitals'

/** Signos que pueden mostrar decimales solo si el usuario los capturó */
const DECIMAL_TYPES = new Set<VitalType | 'BMI'>([
  'GLUCOSE',
  'GLUCOSE_FAST',
  'TEMPERATURE',
  'WEIGHT',
  'WAIST',
  'HIP',
  'BMI',
])

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function hasFraction(value: number): boolean {
  return Math.abs(value - Math.round(value)) > 1e-6
}

function formatNumber(value: number, allowDecimals: boolean): string {
  if (!allowDecimals || !hasFraction(value)) {
    return String(Math.round(value))
  }
  return parseFloat(value.toFixed(2)).toString()
}

/** Formatea un valor de signo vital para mostrar en UI */
export function formatVitalValue(
  type: VitalType | 'BMI',
  value: unknown,
  secondaryValue?: unknown,
): string {
  const primary = toNum(value)
  if (primary == null) return '—'

  if (type === 'BLOOD_PRESSURE') {
    const secondary = toNum(secondaryValue)
    if (secondary != null) {
      return `${Math.round(primary)}/${Math.round(secondary)}`
    }
    return String(Math.round(primary))
  }

  return formatNumber(primary, DECIMAL_TYPES.has(type))
}
