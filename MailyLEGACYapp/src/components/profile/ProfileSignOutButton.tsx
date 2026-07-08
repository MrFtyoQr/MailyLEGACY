/**
 * ProfileSignOutButton — cierre de sesión con estilo 3D consistente.
 */

import React from 'react'
import { Button } from '@components/ui/Button'

interface ProfileSignOutButtonProps {
  onPress: () => void
}

export function ProfileSignOutButton({ onPress }: ProfileSignOutButtonProps) {
  return (
    <Button
      label="Cerrar sesión"
      variant="danger"
      fullWidth
      onPress={onPress}
    />
  )
}
