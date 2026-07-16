import type { PlayerProfile } from '@hooks/useGamification'

/** Último perfil de gamificación conocido en la sesión. */
let lastKnownProfile: PlayerProfile | null = null

export function getLastKnownProfile(): PlayerProfile | null {
  return lastKnownProfile
}

export function setLastKnownProfile(profile: PlayerProfile) {
  lastKnownProfile = profile
}

export function resetProfileTracker() {
  lastKnownProfile = null
}
