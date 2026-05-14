import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, del } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

// ── Tipos que coinciden con el modelo real del backend ────────────────────────

export type VitalType =
  | 'BLOOD_PRESSURE' | 'HEART_RATE'   | 'OXYGEN_SAT'  | 'RESPIRATORY'
  | 'GLUCOSE'        | 'GLUCOSE_FAST' | 'WEIGHT'       | 'HEIGHT'
  | 'BMI'            | 'WAIST'        | 'HIP'          | 'TEMPERATURE'
  | 'STEPS'          | 'SLEEP_HOURS'

export interface VitalReading {
  id:              string
  vital_type:      VitalType
  value:           number
  secondary_value: number | null
  unit:            string
  source:          'MANUAL' | 'DEVICE' | 'INTEGRATION'
  notes:           string | null
  recorded_at:     string
  created_at:      string
}

export interface VitalLatest {
  vital_type:      VitalType
  value:           number
  secondary_value: number | null
  unit:            string
  recorded_at:     string
}

export interface VitalGoal {
  id:            string
  vital_type:    VitalType
  min_value:     number
  max_value:     number
  min_secondary: number | null
  max_secondary: number | null
  notes:         string | null
  is_active:     boolean
  set_by:        string | null
}

export interface VitalSummaryEntry {
  vital_type:       VitalType
  unit:             string
  count:            number
  min_value:        number
  max_value:        number
  avg_value:        number
  last_value:       number
  last_recorded_at: string
}

export interface AddVitalPayload {
  vital_type:      VitalType
  value:           number
  secondary_value?: number
  recorded_at:     string
  unit?:           string
  source?:         'MANUAL' | 'DEVICE' | 'INTEGRATION'
  notes?:          string
}

// ── Metadatos locales para UI ─────────────────────────────────────────────────

export const VITAL_META: Record<VitalType, {
  label:     string
  unit:      string
  min:       number
  max:       number
  icon:      string
  normal:    { min: number; max: number }
  secondary?: { label: string; min: number; max: number }
}> = {
  BLOOD_PRESSURE: { label: 'Presión arterial', unit: 'mmHg', min: 60,  max: 250, icon: '🫀',
    normal: { min: 90, max: 140 },
    secondary: { label: 'Diastólica', min: 40, max: 120 } },
  HEART_RATE:     { label: 'Frec. cardíaca',   unit: 'bpm',  min: 30,  max: 250, icon: '💓',
    normal: { min: 60, max: 100 } },
  OXYGEN_SAT:     { label: 'Saturación O₂',    unit: '%',    min: 70,  max: 100, icon: '🫁',
    normal: { min: 95, max: 100 } },
  RESPIRATORY:    { label: 'Frec. respiratoria', unit: 'rpm', min: 8,  max: 60,  icon: '🌬️',
    normal: { min: 12, max: 20 } },
  GLUCOSE:        { label: 'Glucosa',           unit: 'mg/dL', min: 40, max: 600, icon: '🩸',
    normal: { min: 70, max: 140 } },
  GLUCOSE_FAST:   { label: 'Glucosa en ayuno',  unit: 'mg/dL', min: 40, max: 600, icon: '🩸',
    normal: { min: 70, max: 100 } },
  WEIGHT:         { label: 'Peso',              unit: 'kg',   min: 1,   max: 500, icon: '⚖️',
    normal: { min: 40, max: 120 } },
  HEIGHT:         { label: 'Talla',             unit: 'cm',   min: 50,  max: 250, icon: '📏',
    normal: { min: 150, max: 200 } },
  BMI:            { label: 'IMC',               unit: 'kg/m²', min: 10, max: 60,  icon: '📊',
    normal: { min: 18.5, max: 25 } },
  WAIST:          { label: 'Cintura',           unit: 'cm',   min: 40,  max: 200, icon: '📐',
    normal: { min: 60, max: 94 } },
  HIP:            { label: 'Cadera',            unit: 'cm',   min: 40,  max: 200, icon: '📐',
    normal: { min: 80, max: 110 } },
  TEMPERATURE:    { label: 'Temperatura',       unit: '°C',   min: 34,  max: 43,  icon: '🌡️',
    normal: { min: 36, max: 37.5 } },
  STEPS:          { label: 'Pasos',             unit: 'pasos', min: 0, max: 50000, icon: '🦶',
    normal: { min: 7000, max: 10000 } },
  SLEEP_HOURS:    { label: 'Horas de sueño',    unit: 'h',    min: 0,   max: 24,  icon: '😴',
    normal: { min: 7, max: 9 } },
}

export const VITAL_TYPES_ORDERED: VitalType[] = [
  'BLOOD_PRESSURE', 'HEART_RATE', 'OXYGEN_SAT', 'RESPIRATORY',
  'GLUCOSE', 'GLUCOSE_FAST', 'TEMPERATURE',
  'WEIGHT', 'HEIGHT', 'BMI', 'WAIST', 'HIP',
  'STEPS', 'SLEEP_HOURS',
]

// ── Queries ───────────────────────────────────────────────────────────────────

export function useVitals(filters?: { type?: VitalType; from?: string; to?: string }) {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to)   params.set('to',   filters.to)
  const qs = params.toString()

  return useQuery<VitalReading[]>({
    queryKey: ['vitals', filters],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<{ results: VitalReading[] }>(
      EP.vitals + (qs ? `?${qs}` : '')
    ).then(r => r.results ?? []),
  })
}

export function useVitalsLatest() {
  return useQuery<VitalLatest[]>({
    queryKey: ['vitals', 'latest'],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<VitalLatest[]>(EP.vitalsLatest),
  })
}

export function useVitalsSummary(from?: string, to?: string) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to)   params.set('to',   to)
  const qs = params.toString()

  return useQuery<VitalSummaryEntry[]>({
    queryKey: ['vitals', 'summary', from, to],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get<VitalSummaryEntry[]>(
      EP.vitalsSummary + (qs ? `?${qs}` : '')
    ),
  })
}

export function useVitalsGoals() {
  return useQuery<VitalGoal[]>({
    queryKey: ['vitals', 'goals'],
    staleTime: 10 * 60 * 1000,
    queryFn:  () => get<{ results: VitalGoal[] }>(EP.vitalsGoals).then(r => r.results ?? []),
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAddVital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddVitalPayload) => post<VitalReading>(EP.vitals, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals'] })
      qc.invalidateQueries({ queryKey: ['patient-dashboard'] })
    },
  })
}

/** Envía múltiples vitales en secuencia. Retorna { ok, failed }. */
export function useAddVitals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payloads: AddVitalPayload[]) => {
      const results = await Promise.allSettled(
        payloads.map(p => post<VitalReading>(EP.vitals, p))
      )
      const failed = results.filter(r => r.status === 'rejected').length
      return { ok: payloads.length - failed, failed }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals'] })
      qc.invalidateQueries({ queryKey: ['patient-dashboard'] })
    },
  })
}
