/**
 * (patient)/profile.tsx
 * Perfil del paciente: info, foto y cerrar sesión.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Capsule3D } from '@components/ui/Capsule3D'
import { InfoCard } from '@components/ui/InfoCard'
import { InfoRow } from '@components/ui/InfoRow'
import { MenuRow } from '@components/ui/MenuRow'
import { IconBadge } from '@components/ui/IconBadge'
import { PointsIconBadge } from '@components/ui/PointsCoin'
import { ProfileAvatarHeader } from '@components/profile/ProfileAvatarHeader'
import { ProfileSignOutButton } from '@components/profile/ProfileSignOutButton'
import { profileStyles } from '@components/profile/profileStyles'
import { uploadProfilePhoto } from '@components/profile/uploadProfilePhoto'
import type { AppIconName } from '@components/ui/AppIcon'
import { Colors } from '@constants/colors'
import { shadeColor } from '@constants/duoTheme'
import { useAuthStore } from '@store/auth.store'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

interface Subscription {
  plan: { name: string; tier: 'FREE' | 'SILVER' | 'GOLD' | 'PLATINUM' } | null
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | null
}

const PLAN_COLORS: Record<string, string> = {
  FREE:     '#8E8E93',
  SILVER:   '#5E9FE0',
  GOLD:     '#F5A623',
  PLATINUM: '#9B59B6',
}

const PLAN_ICONS: Record<string, AppIconName> = {
  FREE: 'card', SILVER: 'medal', GOLD: 'trophy', PLATINUM: 'star',
}

export default function PatientProfileScreen() {
  const user       = useAuthStore((s) => s.user)
  const signOut    = useAuthStore((s) => s.signOut)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [photoLoading, setPhotoLoading] = useState(false)

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
      const photoUrl = await uploadProfilePhoto(EP.profilePatientPhoto, result.assets[0])
      updateUser({ photoUrl })
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la foto. Intenta de nuevo.')
    } finally {
      setPhotoLoading(false)
    }
  }

  const { data: subscription } = useQuery<Subscription>({
    queryKey:  ['subscription'],
    staleTime: 5 * 60_000,
    queryFn:   () => get<Subscription>(EP.subscription),
    retry:     false,
  })

  const tier      = subscription?.plan?.tier ?? 'FREE'
  const planName  = subscription?.plan?.name ?? 'Plan Gratuito'
  const planColor = PLAN_COLORS[tier] ?? PLAN_COLORS.FREE
  const planIcon  = PLAN_ICONS[tier]  ?? PLAN_ICONS.FREE

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
        roleLabel="Paciente"
        roleBadge="warning"
        avatarColor={Colors.role.patient}
        onPickPhoto={handlePickPhoto}
        photoLoading={photoLoading}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={profileStyles.content}
      >
        <InfoCard style={profileStyles.planCard}>
          <View style={profileStyles.planCardInner}>
            <IconBadge name={planIcon} size={20} accent={planColor} />
            <View style={{ flex: 1 }}>
              <Text style={profileStyles.planLabel}>Plan activo</Text>
              <Text style={[profileStyles.planName, { color: planColor }]}>{planName}</Text>
            </View>
            <Capsule3D
              pressable
              onPress={() => router.push('/(patient)/plans')}
              faceColor={tier === 'FREE' ? PLAN_COLORS.GOLD : planColor}
              shadowColor={shadeColor(tier === 'FREE' ? PLAN_COLORS.GOLD : planColor, 0.18)}
              depth="sm"
              borderRadius={12}
              faceStyle={profileStyles.upgradeBtnFace}
            >
              <Text style={profileStyles.upgradeBtnText}>
                {tier === 'FREE' ? 'Mejorar' : 'Ver plan'}
              </Text>
            </Capsule3D>
          </View>
        </InfoCard>

        <Text style={profileStyles.sectionTitle}>Información</Text>
        <Card>
          <InfoRow icon="user" label="Nombre" value={fullName} />
          {user?.email && <InfoRow icon="mail" label="Email" value={user.email} divider />}
          <InfoRow icon="tag" label="Rol" value="Paciente" divider />
          <InfoRow icon={planIcon} label="Plan" value={planName} divider />
        </Card>

        <Text style={profileStyles.sectionTitle}>Configuración</Text>
        <Card style={{ padding: 0 }}>
          <MenuRow
            icon="card"
            label="Planes y suscripción"
            onPress={() => router.push('/(patient)/plans')}
          />
          <View style={profileStyles.menuDivider} />
          <MenuRow
            icon="bell"
            label="Notificaciones"
            onPress={() => router.push('/(patient)/notifications')}
          />
          <View style={profileStyles.menuDivider} />
          <MenuRow
            leftIcon={<PointsIconBadge size={22} />}
            label="Mis puntos y logros"
            onPress={() => router.push('/(patient)/gamification')}
          />
          <View style={profileStyles.menuDivider} />
          <MenuRow
            icon="folder"
            label="Mis documentos"
            onPress={() => router.push('/(patient)/documents')}
          />
        </Card>

        <ProfileSignOutButton onPress={handleSignOut} />

        <Text style={profileStyles.version}>MailyT-Cuida v1.0</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}
