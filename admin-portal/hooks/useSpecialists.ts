'use client'
import { useQuery } from '@tanstack/react-query'
import { apiGet }   from '@/lib/api'
import { EP }       from '@/lib/endpoints'

export interface AdminSpecialist {
  id:                  string
  name:                string
  email:               string
  specialist_type:     string
  specialty_area:      string
  license_number:      string
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  verified_at:         string | null
  is_active:           boolean
  created_at:          string
  avatar_url:          string | null
}

export interface SpecialistsResponse {
  count:   number
  page:    number
  pages:   number
  results: AdminSpecialist[]
}

export function useSpecialists(params?: Record<string, string | number | undefined>) {
  return useQuery<SpecialistsResponse>({
    queryKey:  ['admin-specialists', params],
    staleTime: 60_000,
    queryFn:   () => apiGet<SpecialistsResponse>(EP.adminSpecialists, async () => null, params),
  })
}
