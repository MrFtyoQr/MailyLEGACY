/**
 * (patient)/profile.tsx
 * Perfil del paciente: info, foto y cerrar sesión.
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
import { useClerk } from '@clerk/clerk-expo'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Avatar } from '@components/ui/Avatar'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Colors } from '@constants/colors'
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

const PLAN_ICONS: Record<string, string> = {
  FREE: '🆓', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎',
}

export default function PatientProfileScreen() {
  const user      = useAuthStore((s) => s.user)
  const clearUser = useAuthStore((s) => s.clear)
  const { signOut } = useClerk()

  const { data: subscription } = useQuery<Subscription>({
    queryKey:  ['subscription'],
    staleTime: 5 * 60_000,
    queryFn:   () => get<Subscription>(EP.subscription),
    retry:     false,
  })

  const tier      = subscription?.plan?.tier ?? 'FREE'
  const planName  = subscription?.plan?.name ?? 'Plan Gratuito'
  const planColor = PLAN_COLORS[tier] ?? PLAN_COLORS.FREE
  const planIcon  = PLAN_ICONS[tier]  ?? '🆓'

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
              clearUser()
              router.replace('/(auth)/sign-in')
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
          bgColor={Colors.role.patient}
        />
        <Text style={styles.name}>{fullName}</Text>
        {user?.email && (
          <Text style={styles.email}>{user.email}</Text>
        )}
        <Badge label="Paciente" variant="warning" size="sm" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Plan de suscripción */}
        <View style={[styles.planCard, { borderLeftColor: planColor }]}>
          <Text style={styles.planIcon}>{planIcon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.planLabel}>Plan activo</Text>
            <Text style={[styles.planName, { color: planColor }]}>{planName}</Text>
          </View>
          {tier === 'FREE' && (
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: PLAN_COLORS.GOLD }]}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeBtnText}>Mejorar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info personal */}
        <Text style={styles.sectionTitle}>Información</Text>
        <Card>
          <InfoRow icon="👤" label="Nombre" value={fullName} />
          {user?.email && <InfoRow icon="✉️" label="Email" value={user.email} divider />}
          <InfoRow icon="🏷️" label="Rol" value="Paciente" divider />
          <InfoRow icon={planIcon} label="Plan" value={planName} divider />
        </Card>

        {/* Opciones */}
        <Text style={styles.sectionTitle}>Configuración</Text>
        <Card style={{ padding: 0 }}>
          <MenuRow
            icon="🔔"
            label="Notificaciones"
            onPress={() => router.push('/(patient)/notifications')}
          />
          <MenuRow
            icon="⭐"
            label="Mis puntos y logros"
            onPress={() => router.push('/(patient)/gamification')}
            divider
          />
          <MenuRow
            icon="🗂️"
            label="Mis documentos"
            onPress={() => router.push('/(patient)/documents')}
            divider
          />
        </Card>

        {/* Cerrar sesión */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.75}
        >
          <Text style={styles.signOutText}>🚪 Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MailyT-Cuida v1.0</Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function InfoRow({
  icon, label, value, divider,
}: { icon: string; label: string; value: string; divider?: boolean }) {
  return (
    <View>
      {divider && <View style={ir.divider} />}
      <View style={ir.row}>
        <Text style={ir.icon}>{icon}</Text>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

const ir = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  divider: { height: 1, backgroundColor: Colors.light.border },
  icon:    { fontSize: 18, width: 26 },
  label:   { fontSize: 14, color: Colors.light.textSecondary, flex: 1 },
  value:   { fontSize: 14, color: Colors.light.textPrimary, fontWeight: '500', flex: 2, textAlign: 'right' },
})

function MenuRow({
  icon, label, onPress, divider,
}: { icon: string; label: string; onPress: () => void; divider?: boolean }) {
  return (
    <View>
      {divider && <View style={{ height: 1, backgroundColor: Colors.light.border, marginLeft: 52 }} />}
      <TouchableOpacity style={mr.row} onPress={onPress} activeOpacity={0.7}>
        <Text style={mr.icon}>{icon}</Text>
        <Text style={mr.label}>{label}</Text>
        <Text style={mr.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  )
}

const mr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  icon:    { fontSize: 18, width: 26 },
  label:   { fontSize: 15, color: Colors.light.textPrimary, flex: 1 },
  chevron: { fontSize: 20, color: Colors.light.textMuted },
})

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

  // Plan card
  planCard: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    backgroundColor: '#fff',
    borderRadius:   14,
    padding:        16,
    borderWidth:    1,
    borderColor:    Colors.light.border,
    borderLeftWidth: 4,
  },
  planIcon:  { fontSize: 26 },
  planLabel: { fontSize: 12, color: Colors.light.textMuted, marginBottom: 2 },
  planName:  { fontSize: 16, fontWeight: '700' },
  upgradeBtn: {
    paddingHorizontal: 14,
    paddingVertical:    8,
    borderRadius:      10,
  },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
})
