/**
 * (specialist)/index.tsx
 * Dashboard del especialista: referidos pendientes.
 */

import React from 'react'
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { Skeleton } from '@components/ui/Skeleton'
import { IconBadge } from '@components/ui/IconBadge'
import { Colors } from '@constants/colors'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import { useAuthStore } from '@store/auth.store'

interface Referral {
  id:         string
  patient:    { first_name: string; last_name: string; photo_url: string | null }
  diagnosis:  string | null
  urgency:    'low' | 'medium' | 'high' | 'critical'
  status:     'pending' | 'in_progress' | 'completed' | 'rejected'
  created_at: string
}

const URGENCY: Record<Referral['urgency'], { label: string; variant: 'neutral' | 'info' | 'warning' | 'error' }> = {
  low:      { label: 'Baja',     variant: 'neutral'  },
  medium:   { label: 'Media',    variant: 'info'     },
  high:     { label: 'Alta',     variant: 'warning'  },
  critical: { label: 'Crítica',  variant: 'error'    },
}

export default function SpecialistHome() {
  const user = useAuthStore((s) => s.user)

  const { data: referrals, isLoading } = useQuery<Referral[]>({
    queryKey:  ['referrals', 'incoming'],
    staleTime: 2 * 60 * 1000,
    queryFn:   () => get<Referral[]>(EP.referralsIncoming),
  })

  const firstName = user?.firstName ?? 'Especialista'
  const lastName  = user?.lastName  ?? ''

  const pending = referrals?.filter((r) => r.status === 'pending') ?? []
  const recent  = referrals?.slice(0, 5) ?? []

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {firstName} {lastName}</Text>
          <Text style={styles.subGreeting}>Panel de especialista</Text>
        </View>
        <Avatar
          uri={user?.photoUrl}
          name={`${firstName} ${lastName}`}
          size={44}
          bgColor={Colors.role.specialist}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stat */}
        {isLoading ? (
          <Skeleton height={90} borderRadius={16} style={styles.skeletonMx} />
        ) : (
          <Card style={styles.statCard}>
            <View style={styles.statRow}>
              <IconBadge name="clipboard" size={28} />
              <View>
                <Text style={styles.statValue}>{pending.length}</Text>
                <Text style={styles.statLabel}>Referidos pendientes</Text>
              </View>
              <TouchableOpacity
                style={styles.statBtn}
                onPress={() => router.push('/(specialist)/referrals/index')}
                activeOpacity={0.7}
              >
                <Text style={styles.statBtnText}>Ver todos</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Referidos recientes */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Referidos recientes</Text>
          {referrals && referrals.length > 5 && (
            <TouchableOpacity onPress={() => router.push('/(specialist)/referrals/index')} activeOpacity={0.7}>
              <Text style={styles.sectionAction}>Ver todos</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <>
            <Skeleton height={80} borderRadius={12} style={styles.skeletonMx} />
            <Skeleton height={80} borderRadius={12} style={[styles.skeletonMx, { marginTop: 8 }]} />
          </>
        ) : recent.length > 0 ? (
          <View style={styles.referralList}>
            {recent.map((r) => {
              const { label, variant } = URGENCY[r.urgency]
              const patientName = `${r.patient.first_name} ${r.patient.last_name}`
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.75}
                  onPress={() => router.push('/(specialist)/referrals/index')}
                >
                  <Card style={styles.referralCard}>
                    <View style={styles.referralRow}>
                      <Avatar
                        uri={r.patient.photo_url}
                        name={patientName}
                        size={40}
                        bgColor={Colors.role.specialist}
                      />
                      <View style={styles.referralInfo}>
                        <Text style={styles.referralName} numberOfLines={1}>{patientName}</Text>
                        {r.diagnosis && (
                          <Text style={styles.referralDiag} numberOfLines={1}>{r.diagnosis}</Text>
                        )}
                      </View>
                      <View style={styles.referralRight}>
                        <Badge label={label} variant={variant} size="sm" />
                        <Text style={styles.referralStatus}>
                          {r.status === 'pending' ? 'Pendiente' : r.status === 'in_progress' ? 'En progreso' : 'Completado'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin referidos recientes</Text>
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  greeting:    { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  subGreeting: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 1 },
  scrollContent: { paddingBottom: 24, gap: 0 },
  skeletonMx: { marginHorizontal: 20 },
  statCard: {
    marginHorizontal: 20,
    marginBottom:     20,
  },
  statRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  statValue: {
    fontSize:   28,
    fontWeight: '700',
    color:      Colors.role.specialist,
  },
  statLabel: { fontSize: 13, color: Colors.light.textSecondary },
  statBtn: {
    marginLeft: 'auto',
    backgroundColor: Colors.role.specialist + '18',
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      8,
  },
  statBtnText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.role.specialist,
  },
  sectionRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    marginBottom:      10,
  },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  sectionAction: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
  referralList:  { paddingHorizontal: 20, gap: 8 },
  referralCard:  { padding: 12 },
  referralRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  referralInfo:   { flex: 1 },
  referralName:   { fontSize: 14, fontWeight: '600', color: Colors.light.textPrimary },
  referralDiag:   { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  referralRight:  { alignItems: 'flex-end', gap: 4 },
  referralStatus: { fontSize: 11, color: Colors.light.textMuted, fontWeight: '600' },
  emptyCard: {
    marginHorizontal: 20,
    alignItems:       'center',
    paddingVertical:  20,
  },
  emptyText: { fontSize: 14, color: Colors.light.textMuted },
})
