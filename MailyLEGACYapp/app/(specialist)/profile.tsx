/**
 * (specialist)/profile.tsx
 * Perfil del especialista con cerrar sesión.
 */

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
} from 'react-native'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { InfoRow } from '@components/ui/InfoRow'
import { ProfileAvatarHeader } from '@components/profile/ProfileAvatarHeader'
import { ProfileSignOutButton } from '@components/profile/ProfileSignOutButton'
import { profileStyles } from '@components/profile/profileStyles'
import { Colors } from '@constants/colors'
import { useAuthStore } from '@store/auth.store'

export default function SpecialistProfileScreen() {
  const user    = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mi Perfil'

  function handleSignOut() {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut()
            } catch {
              Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.')
            }
          },
        },
      ],
    )
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      <ProfileAvatarHeader
        fullName={fullName}
        email={user?.email}
        photoUrl={user?.photoUrl}
        roleLabel="Especialista"
        roleBadge="success"
        avatarColor={Colors.role.specialist}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={profileStyles.content}
      >
        <Text style={profileStyles.sectionTitle}>Información</Text>
        <Card>
          <InfoRow icon="user" label="Nombre" value={fullName} />
          {user?.email && <InfoRow icon="mail" label="Email" value={user.email} divider />}
          <InfoRow icon="tag" label="Rol" value="Especialista" divider />
        </Card>

        <ProfileSignOutButton onPress={handleSignOut} />

        <Text style={profileStyles.version}>MailyT-Cuida v1.0</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}
