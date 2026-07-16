import type { QueryClient } from '@tanstack/react-query'
import type { PlayerProfile } from '@hooks/useGamification'
import { applyProfileCelebrations } from '@lib/gamification/applyProfileCelebrations'
import {
  getLastKnownProfile,
  setLastKnownProfile,
} from '@lib/gamification/playerProfileTracker'
import { fetchPlayerProfile } from '@hooks/useGamification'

/** Refresca el perfil y dispara tarjetas si hubo insignia o subida de nivel. */
export async function refreshProfileAndCelebrate(
  qc: QueryClient,
  prevSnapshot?: PlayerProfile | null,
) {
  const prev = prevSnapshot ?? getLastKnownProfile() ?? qc.getQueryData<PlayerProfile>(['player-profile'])
  const next = await qc.fetchQuery({
    queryKey: ['player-profile'],
    queryFn:  fetchPlayerProfile,
  })
  if (prev) {
    applyProfileCelebrations(prev, next)
  }
  setLastKnownProfile(next)
  return next
}
