/**
 * (doctor)/profile.tsx
 * Perfil del médico con cerrar sesión.
 */

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Avatar } from '@components/ui/Avatar'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { InfoRow } from '@components/ui/InfoRow'
import { Colors } from '@constants/colors'
import { useAuthStore } from '@store/auth.store'

export default function DoctorProfileScreen() {
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
      {/* Header con avatar */}
      <View style={styles.profileHeader}>
        <Avatar
          uri={user?.photoUrl}
          name={fullName}
          size={88}
          bgColor={Colors.role.doctor}
        />
        <Text style={styles.name}>Dr. {fullName}</Text>
        {user?.email && <Text style={styles.email}>{user.email}</Text>}
        <Badge label="Médico" variant="info" size="sm" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionTitle}>Información</Text>
        <Card>
          <InfoRow icon="user" label="Nombre" value={`Dr. ${fullName}`} />
          {user?.email && <InfoRow icon="mail" label="Email" value={user.email} divider />}
          <InfoRow icon="tag" label="Rol" value="Médico" divider />
        </Card>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.75}
        >
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MailyT-Cuida v1.0</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems:        'center',
    paddingTop:        24,
    paddingBottom:     20,
    gap:               8,
    backgroundColor:   Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  name: {
    fontSize:   22,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    marginTop:  4,
  },
  email: {
    fontSize: 14,
    color:    Colors.light.textSecondary,
  },
  content: {
    gap:           16,
    padding:       20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize:      14,
    fontWeight:    '700',
    color:         Colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signOutBtn: {
    backgroundColor: Colors.semantic.errorBg,
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
  },
  signOutText: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.semantic.error,
  },
  version: {
    fontSize:  12,
    color:     Colors.light.textMuted,
    textAlign: 'center',
  },
})
