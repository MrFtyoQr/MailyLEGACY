import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

export interface Appointment {
  id:           string
  doctor_name:  string
  specialty:    string
  scheduled_at: string
  duration_min: number
  status:       'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  notes:        string | null
  location:     string | null
}

export function useAppointments() {
  return useQuery<Appointment[]>({
    queryKey: ['appointments'],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<{ results: Appointment[] }>(EP.appointments).then(r => r.results ?? []),
  })
}

export function useAppointment(id: string) {
  return useQuery<Appointment>({
    queryKey: ['appointments', id],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<Appointment>(EP.appointment(id)),
    enabled:  !!id,
  })
}

export function useDoctorAppointments() {
  return useQuery<Appointment[]>({
    queryKey: ['appointments', 'doctor'],
    staleTime: 2 * 60 * 1000,
    queryFn:  () => get<{ results: Appointment[] }>(EP.appointmentsDoctor).then(r => r.results ?? []),
  })
}

export function useCancelAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post(EP.appointmentCancel(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

export function useConfirmAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post(EP.appointmentConfirm(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments', 'doctor'] })
    },
  })
}

export function useCompleteAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post(EP.appointmentComplete(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments', 'doctor'] })
    },
  })
}
