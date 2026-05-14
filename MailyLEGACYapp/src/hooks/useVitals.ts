import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

export interface VitalEntry {
  id:           string
  glucose_mgdl: number | null
  heart_rate:   number | null
  systolic_bp:  number | null
  diastolic_bp: number | null
  weight_kg:    number | null
  notes:        string | null
  recorded_at:  string
  severity:     'normal' | 'warning' | 'critical' | null
}

export interface VitalSummary {
  avg_glucose:   number | null
  avg_heart_rate: number | null
  avg_systolic:  number | null
  avg_diastolic: number | null
  total_records: number
}

export function useVitals() {
  return useQuery<VitalEntry[]>({
    queryKey: ['vitals'],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<{ results: VitalEntry[] }>(EP.vitals).then(r => r.results ?? []),
  })
}

export function useVitalsLatest() {
  return useQuery<VitalEntry | null>({
    queryKey: ['vitals', 'latest'],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<VitalEntry>(EP.vitalsLatest).catch(() => null),
  })
}

export function useVitalsSummary() {
  return useQuery<VitalSummary>({
    queryKey: ['vitals', 'summary'],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get<VitalSummary>(EP.vitalsSummary),
  })
}

export function useAddVital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Omit<VitalEntry, 'id' | 'recorded_at' | 'severity'>>) =>
      post<VitalEntry>(EP.vitals, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals'] })
      qc.invalidateQueries({ queryKey: ['patient-dashboard'] })
    },
  })
}
