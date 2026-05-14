/**
 * (doctor)/index.tsx
 * Dashboard del médico: pacientes recientes + próximas citas.
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
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Avatar } from '@components/ui/Avatar'
import { Skeleton } from '@components/ui/Skeleton'
import { AppointmentCard } from '@components/appointments/AppointmentCard'
import { Colors } from '@constants/colors'
import { useAuthStore } from '@store/auth.store'
import { usePatients } from '@hooks/usePatients'
import { useDoctorAppointments } from '@hooks/useAppointments'

export default function DoctorHome() {
  const user = useAuthStore((s) => s.user)

  const { data: patients, isLoading: loadingPatients } = usePatients()
  const { data: appts,    isLoading: loadingAppts    } = useDoctorAppointments()

  const firstName = user?.firstName ?? 'Doctor'
  const lastName  = user?.lastName  ?? ''

  // Próximas citas (futuras, ordenadas)
  const upcomingAppts = appts
    ?.filter((a) => new Date(a.scheduled_at) >= new Date() && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 3)

  // Últimos 3 pacientes
  const recentPatients = (patients ?? []).slice(0, 3)

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, Dr. {lastName || firstName} 👋</Text>
          <Text style={styles.subGreeting}>Panel médico</Text>
        </View>
        <Avatar
          uri={user?.photoUrl}
          name={`${firstName} ${lastName}`}
          size={44}
          bgColor={Colors.role.doctor}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats rápidas */}
        <View style={styles.statsRow}>
          <StatCard
            icon="👥"
            value={patients?.length ?? '—'}
            label="Pacientes"
            color={Colors.role.doctor}
            isLoading={loadingPatients}
          />
          <StatCard
            icon="📅"
            value={upcomingAppts?.length ?? '—'}
            label="Citas hoy"
            color={Colors.brand.primary}
            isLoading={loadingAppts}
          />
        </View>

        {/* Pacientes recientes */}
        <SectionHeader
          title="Pacientes recientes"
          onAction={() => router.push('/(doctor)/patients/index')}
          actionLabel="Ver todos"
        />

        {loadingPatients ? (
          <Skeleton height={60} borderRadius={12} style={{ marginHorizontal: 20 }} />
        ) : recentPatients.length > 0 ? (
          <View style={styles.patientList}>
            {recentPatients.map((p) => {
              const fullName = `${p.first_name} ${p.last_name}`
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.patientRow}
                  onPress={() =>
                    router.push({ pathname: '/(doctor)/patients/[id]', params: { id: p.id } })
                  }
                  activeOpacity={0.75}
                >
                  <Avatar uri={p.photo_url} name={fullName} size={40} bgColor={Colors.role.doctor} />
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName} numberOfLines={1}>{fullName}</Text>
                    <Text style={styles.patientEmail} numberOfLines={1}>{p.email}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin pacientes asignados</Text>
          </Card>
        )}

        {/* Próximas citas */}
        <SectionHeader
          title="Próximas citas"
          onAction={() => router.push('/(doctor)/appointments/index')}
          actionLabel="Ver agenda"
        />

        {loadingAppts ? (
          <Skeleton height={90} borderRadius={16} style={{ marginHorizontal: 20 }} />
        ) : upcomingAppts && upcomingAppts.length > 0 ? (
          <View style={{ paddingHorizontal: 20 }}>
            {upcomingAppts.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin citas próximas</Text>
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function SectionHeader({
  title, onAction, actionLabel,
}: { title: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {onAction && actionLabel && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={sh.action}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const sh = StyleSheet.create({
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    marginTop:         20,
    marginBottom:      10,
    paddingHorizontal: 20,
  },
  title:  { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  action: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
})

function StatCard({
  icon, value, label, color, isLoading,
}: { icon: string; value: number | string; label: string; color: string; isLoading: boolean }) {
  return (
    <Card style={[sc.card, { borderTopColor: color }]}>
      <Text style={sc.icon}>{icon}</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[sc.value, { color }]}>{value}</Text>
      )}
      <Text style={sc.label}>{label}</Text>
    </Card>
  )
}

const sc = StyleSheet.create({
  card: {
    flex:          1,
    alignItems:    'center',
    gap:           4,
    borderTopWidth: 3,
    paddingVertical: 14,
  },
  icon:  { fontSize: 24 },
  value: { fontSize: 26, fontWeight: '700' },
  label: { fontSize: 12, color: Colors.light.textMuted, fontWeight: '500' },
})

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
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  statsRow: {
    flexDirection:     'row',
    gap:               12,
    paddingHorizontal: 20,
  },
  patientList: {
    marginHorizontal: 20,
    backgroundColor:  Colors.light.card,
    borderRadius:     12,
    overflow:         'hidden',
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.04,
    shadowRadius:     4,
    elevation:        2,
  },
  patientRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 16,
    gap:               12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  patientInfo:  { flex: 1 },
  patientName:  { fontSize: 15, fontWeight: '600', color: Colors.light.textPrimary },
  patientEmail: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 1 },
  chevron:      { fontSize: 18, color: Colors.light.textMuted },
  emptyCard: {
    marginHorizontal: 20,
    alignItems:       'center',
    paddingVertical:  20,
  },
  emptyText: { fontSize: 14, color: Colors.light.textMuted },
})
