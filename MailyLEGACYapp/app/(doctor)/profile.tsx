/**
 * (doctor)/profile.tsx
 * Perfil del médico con cerrar sesión.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { InfoRow } from '@components/ui/InfoRow'
import { ProfileAvatarHeader } from '@components/profile/ProfileAvatarHeader'
import { ProfileSignOutButton } from '@components/profile/ProfileSignOutButton'
import { profileStyles } from '@components/profile/profileStyles'
import { uploadProfilePhoto } from '@components/profile/uploadProfilePhoto'
import { Colors } from '@constants/colors'
import { useAuthStore } from '@store/auth.store'
import { EP } from '@lib/api/endpoints'

export default function DoctorProfileScreen() {
  const user       = useAuthStore((s) => s.user)
  const signOut    = useAuthStore((s) => s.signOut)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [photoLoading, setPhotoLoading] = useState(false)

  const fullName     = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mi Perfil'
  const displayName  = `Dr. ${fullName}`

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para cambiar la foto de perfil.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled) return

    setPhotoLoading(true)
    try {
      const photoUrl = await uploadProfilePhoto(EP.profileDoctorPhoto, result.assets[0])
      updateUser({ photoUrl })
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la foto. Intenta de nuevo.')
    } finally {
      setPhotoLoading(false)
    }
  }

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
        fullName={displayName}
        email={user?.email}
        photoUrl={user?.photoUrl}
        roleLabel="Médico"
        roleBadge="info"
        avatarColor={Colors.role.doctor}
        onPickPhoto={handlePickPhoto}
        photoLoading={photoLoading}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={profileStyles.content}
      >
        <Text style={profileStyles.sectionTitle}>Información</Text>
        <Card>
          <InfoRow icon="user" label="Nombre" value={displayName} />
          {user?.email && <InfoRow icon="mail" label="Email" value={user.email} divider />}
          <InfoRow icon="tag" label="Rol" value="Médico" divider />
        </Card>

        <ProfileSignOutButton onPress={handleSignOut} />

        <Text style={profileStyles.version}>MailyT-Cuida v1.0</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}
