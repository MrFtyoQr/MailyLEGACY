'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { apiGet } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import type { DashboardData } from '@/types'

export function useDashboard() {
  const { getToken } = useAuth()

  return useQuery<DashboardData>({
    queryKey:  ['admin-dashboard'],
    staleTime: 60_000,    // 1 min
    queryFn:   () => apiGet<DashboardData>(EP.adminDashboard, getToken),
  })
}
