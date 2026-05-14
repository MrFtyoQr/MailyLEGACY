import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

export interface Medication {
  id:           string
  name:         string
  dose:         string
  frequency:    string
  instructions: string | null
  is_active:    boolean
  start_date:   string
  end_date:     string | null
}

export interface MedHistoryEntry {
  id:            string
  medication_id: string
  medication:    { name: string; dose: string }
  scheduled_at:  string
  status:        'pending' | 'taken' | 'skipped' | 'postponed'
  taken_at:      string | null
}

export function useMedications() {
  return useQuery<Medication[]>({
    queryKey: ['medications'],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get<Medication[]>(EP.medications),
  })
}

export function useMedicationsToday() {
  return useQuery<MedHistoryEntry[]>({
    queryKey: ['medications', 'today'],
    staleTime: 60 * 1000,  // 1 min — se actualiza frecuente
    queryFn:  () => get<MedHistoryEntry[]>(EP.medicationToday),
  })
}

export function useMedication(id: string) {
  return useQuery<Medication>({
    queryKey: ['medications', id],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get<Medication>(EP.medicationDetail(id)),
    enabled:  !!id,
  })
}

export function useTakeMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (historyId: string) => post(EP.medicationTake(historyId), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications', 'today'] })
      qc.invalidateQueries({ queryKey: ['patient-dashboard'] })
    },
  })
}

export function useSkipMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (historyId: string) => post(EP.medicationSkip(historyId), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications', 'today'] })
    },
  })
}
