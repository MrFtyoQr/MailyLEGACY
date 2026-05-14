import { useQuery } from '@tanstack/react-query'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

export interface Patient {
  id:          string
  user_id:     string
  first_name:  string
  last_name:   string
  email:       string
  photo_url:   string | null
  birth_date:  string | null
  last_vital_at: string | null
}

export function usePatients() {
  return useQuery<Patient[]>({
    queryKey: ['patients'],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get<{ results: Patient[] }>(EP.doctorPatients).then(r => r.results ?? []),
  })
}

export function usePatient(id: string) {
  return useQuery<Patient>({
    queryKey: ['patients', id],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get<Patient>(EP.doctorPatient(id)),
    enabled:  !!id,
  })
}

export function usePatientVitals(patientId: string) {
  return useQuery({
    queryKey: ['patients', patientId, 'vitals'],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get(EP.vitalsPatientLatest(patientId)),
    enabled:  !!patientId,
  })
}

export function usePatientMedications(patientId: string) {
  return useQuery({
    queryKey: ['patients', patientId, 'medications'],
    staleTime: 5 * 60 * 1000,
    queryFn:  () => get(EP.medicationsPatient(patientId)),
    enabled:  !!patientId,
  })
}
