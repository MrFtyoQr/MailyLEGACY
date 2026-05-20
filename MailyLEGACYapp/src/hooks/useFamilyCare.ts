import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LinkStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'

export interface FamilyLink {
  id:           string
  caregiver_name: string
  relationship: string
  status:       LinkStatus
  created_at:   string
  accepted_at:  string | null
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFamilyLinks() {
  return useQuery<{ results: FamilyLink[]; count: number }>({
    queryKey: ['family-links'],
    queryFn:  () => get(EP.familyCareLinks),
    staleTime: 60_000,
  })
}

export function useAcceptLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post(EP.familyCareLinkAccept(id), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-links'] }),
  })
}

export function useRevokeLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post(EP.familyCareLinkRevoke(id), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-links'] }),
  })
}
