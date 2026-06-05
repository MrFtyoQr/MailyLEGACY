'use client'
import { useQuery } from '@tanstack/react-query'
import { apiGet }   from '@/lib/api'
import { EP }       from '@/lib/endpoints'

export interface AdminUser {
  id:          string
  email:       string
  phone:       string
  role:        string
  is_active:   boolean
  created_at:  string
  first_name:  string
  last_name:   string
  photo_url:   string | null
  birth_date:  string | null
  plan_tier:   'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  plan_name:   string
  vital_count: number
}

export interface UsersResponse {
  count:   number
  results: AdminUser[]
}

export function useUsers(params?: Record<string, string | number | undefined>) {
  return useQuery<UsersResponse>({
    queryKey:  ['admin-users', params],
    staleTime: 60_000,
    queryFn:   () => apiGet<UsersResponse>(EP.adminUsers, async () => null, params),
  })
}
