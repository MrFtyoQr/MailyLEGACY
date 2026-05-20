'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { apiGet } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import type { AuditResponse, AuditFilters } from '@/types'

export function useAuditLog(filters: AuditFilters = {}) {
  const { getToken } = useAuth()

  // Remove undefined values from filters
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string | number>

  return useQuery<AuditResponse>({
    queryKey:  ['audit', params],
    staleTime: 30_000,
    queryFn:   () => apiGet<AuditResponse>(EP.audit, getToken, params),
  })
}
