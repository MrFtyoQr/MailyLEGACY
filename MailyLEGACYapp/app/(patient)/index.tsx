/**
 * (patient)/index.tsx
 * Dashboard principal del paciente.
 * Muestra: saludo, vitales recientes, medicamentos del día, próxima cita y gamificación.
 */

import React from 'react'
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { Skeleton } from '@components/ui/Skeleton'
import { Colors } from '@constants/colors'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import { useAuthStore } from '@store/auth.store'
import { useWsStore } from '@store/ws.store'
import { useVitalsLatest } from '@hooks/useVitals'
import { useMedicationsToday } from '@hooks/useMedications'
import { useAppointments } from '@hooks/useAppointments'

// ── Gamification types ───────────────────────────────────────────────────────
interface GamificationData {
  points:         number
  level:          number
  level_name:     string
  streak_days:    number
  next_level_pts: number
}

export default function PatientHome() {
  const user      = useAuthStore((s) => s.user)
  const unread    = useWsStore((s) => s.unreadCount)

  const { data: vitals,  isLoading: loadingVitals  } = useVitalsLatest()
  const { data: medsRaw, isLoading: loadingMeds    } = useMedicationsToday()
  const { data: appts,   isLoading: loadingAppts   } = useAppointments()
  const { data: gamif,   isLoading: loadingGamif   } = useQuery<GamificationData>({
    queryKey:  ['gamification'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<GamificationData>(EP.gamification),
  })

  const firstName = user?.firstName ?? 'Paciente'

  // Próxima cita futura confirmada o pendiente
  const nextAppt = appts
    ?.filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]

  // Adherencia del día
  const totalMeds  = medsRaw?.length ?? 0
  const takenMeds  = medsRaw?.filter((m) => m.status === 'taken').length ?? 0
  const adherence  = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : null

  const SEVERITY_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
    normal:   'success',
    warning:  'warning',
    critical: 'error',
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar uri={user?.photoUrl} name={firstName} size={44} bgColor={Colors.role.patient} />
          <View>
            <Text style={styles.greeting}>Hola, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>¿Cómo te encuentras hoy?</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => router.push('/(patient)/notifications')}
          activeOpacity={0.7}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Vitales ── */}
        <SectionHeader
          title="Últimos signos vitales"
          onAction={() => router.push('/(patient)/vitals/index')}
          actionLabel="Ver todo"
        />
        {loadingVitals ? (
          <Skeleton height={110} borderRadius={16} />
        ) : vitals ? (
          <Card style={styles.vitalsCard}>
            <View style={styles.vitalsRow}>
              {vitals.heart_rate != null && (
                <VitalChip icon="❤️" value={`${vitals.heart_rate}`} unit="lpm" />
              )}
              {vitals.glucose_mgdl != null && (
                <VitalChip icon="🩸" value={`${vitals.glucose_mgdl}`} unit="mg/dL" />
              )}
              {vitals.systolic_bp != null && vitals.diastolic_bp != null && (
                <VitalChip
                  icon="💉"
                  value={`${vitals.systolic_bp}/${vitals.diastolic_bp}`}
                  unit="mmHg"
                />
              )}
              {vitals.weight_kg != null && (
                <VitalChip icon="⚖️" value={`${vitals.weight_kg}`} unit="kg" />
              )}
            </View>
            {vitals.severity && (
              <View style={{ marginTop: 10 }}>
                <Badge
                  label={
                    vitals.severity === 'normal'
                      ? 'Normal'
                      : vitals.severity === 'warning'
                      ? 'En alerta'
                      : 'Crítico'
                  }
                  variant={SEVERITY_VARIANT[vitals.severity]}
                  size="sm"
                />
              </View>
            )}
            <TouchableOpacity
              style={styles.addVitalBtn}
              onPress={() => router.push('/(patient)/vitals/add')}
              activeOpacity={0.7}
            >
              <Text style={styles.addVitalText}>+ Registrar nuevo</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>Sin vitales registrados</Text>
            <TouchableOpacity onPress={() => router.push('/(patient)/vitals/add')} activeOpacity={0.7}>
              <Text style={styles.emptyAction}>Registrar primero</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* ── Medicamentos del día ── */}
        <SectionHeader
          title="Medicamentos de hoy"
          onAction={() => router.push('/(patient)/medications/index')}
          actionLabel="Ver todo"
        />
        {loadingMeds ? (
          <Skeleton height={80} borderRadius={16} />
        ) : totalMeds > 0 ? (
          <Card style={styles.medsCard}>
            <View style={styles.medsRow}>
              <View>
                <Text style={styles.medsCount}>{takenMeds}/{totalMeds}</Text>
                <Text style={styles.medsLabel}>tomados</Text>
              </View>
              {adherence !== null && (
                <AdherencePill pct={adherence} />
              )}
            </View>
            {/* Mini lista de pendientes */}
            {medsRaw
              ?.filter((m) => m.status === 'pending')
              .slice(0, 2)
              .map((m) => (
                <View key={m.id} style={styles.medRow}>
                  <View style={styles.medDot} />
                  <Text style={styles.medName} numberOfLines={1}>
                    {m.medication.name} — {m.medication.dose}
                  </Text>
                </View>
              ))}
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin medicamentos para hoy</Text>
          </Card>
        )}

        {/* ── Próxima cita ── */}
        <SectionHeader
          title="Próxima cita"
          onAction={() => router.push('/(patient)/appointments/index')}
          actionLabel="Ver agenda"
        />
        {loadingAppts ? (
          <Skeleton height={90} borderRadius={16} />
        ) : nextAppt ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() =>
              router.push({ pathname: '/(patient)/appointments/[id]', params: { id: nextAppt.id } })
            }
          >
            <Card style={styles.apptCard}>
              <View style={styles.apptRow}>
                <Text style={styles.apptEmoji}>📅</Text>
                <View style={styles.apptInfo}>
                  <Text style={styles.apptDoctor} numberOfLines={1}>
                    {nextAppt.doctor_name}
                  </Text>
                  <Text style={styles.apptSpec}>{nextAppt.specialty}</Text>
                  <Text style={styles.apptDate}>
                    {new Date(nextAppt.scheduled_at).toLocaleDateString('es-MX', {
                      weekday: 'long', day: '2-digit', month: 'long',
                    })}
                    {' · '}
                    {new Date(nextAppt.scheduled_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin citas próximas</Text>
          </Card>
        )}

        {/* ── Gamificación ── */}
        <SectionHeader title="Tu progreso" />
        {loadingGamif ? (
          <Skeleton height={80} borderRadius={16} />
        ) : gamif ? (
          <Card style={styles.gamifCard}>
            <View style={styles.gamifRow}>
              <View>
                <Text style={styles.gamifLevel}>Nivel {gamif.level}</Text>
                <Text style={styles.gamifName}>{gamif.level_name}</Text>
              </View>
              <View style={styles.gamifRight}>
                <Text style={styles.gamifPoints}>{gamif.points} pts</Text>
                {gamif.streak_days > 0 && (
                  <Text style={styles.gamifStreak}>🔥 {gamif.streak_days} días seguidos</Text>
                )}
              </View>
            </View>
            {/* Barra de progreso */}
            <ProgressBar current={gamif.points} max={gamif.next_level_pts} />
          </Card>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  onAction,
  actionLabel,
}: {
  title: string
  onAction?: () => void
  actionLabel?: string
}) {
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
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      20,
    marginBottom:   8,
    paddingHorizontal: 20,
  },
  title: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  action: {
    fontSize:  13,
    color:     Colors.brand.primary,
    fontWeight: '600',
  },
})

function VitalChip({ icon, value, unit }: { icon: string; value: string; unit: string }) {
  return (
    <View style={vc.chip}>
      <Text style={vc.icon}>{icon}</Text>
      <Text style={vc.value}>{value}</Text>
      <Text style={vc.unit}>{unit}</Text>
    </View>
  )
}

const vc = StyleSheet.create({
  chip: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  icon:  { fontSize: 20 },
  value: { fontSize: 17, fontWeight: '700', color: Colors.light.textPrimary },
  unit:  { fontSize: 11, color: Colors.light.textMuted },
})

function AdherencePill({ pct }: { pct: number }) {
  const color = pct >= 80 ? Colors.semantic.success : pct >= 50 ? Colors.semantic.warning : Colors.semantic.error
  const bg    = pct >= 80 ? Colors.semantic.successBg : pct >= 50 ? Colors.semantic.warningBg : Colors.semantic.errorBg
  return (
    <View style={[ap.pill, { backgroundColor: bg }]}>
      <Text style={[ap.text, { color }]}>{pct}%</Text>
      <Text style={[ap.sub, { color }]}>adherencia</Text>
    </View>
  )
}

const ap = StyleSheet.create({
  pill: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  text: { fontSize: 22, fontWeight: '700' },
  sub:  { fontSize: 11, fontWeight: '500' },
})

function ProgressBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min((current / max) * 100, 100)
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` as `${number}%` }]} />
    </View>
  )
}

const pb = StyleSheet.create({
  track: {
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.light.surface,
    marginTop:       12,
    overflow:        'hidden',
  },
  fill: {
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.brand.primary,
  },
})

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  greeting: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  subGreeting: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
    marginTop: 1,
  },
  bellBtn: {
    padding:  4,
    position: 'relative',
  },
  bellIcon: { fontSize: 24 },
  badge: {
    position:        'absolute',
    top:             0,
    right:           0,
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: Colors.semantic.error,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      '#fff',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Vitals
  vitalsCard: { marginHorizontal: 20 },
  vitalsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  addVitalBtn: { marginTop: 12, alignItems: 'center' },
  addVitalText: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },

  // Meds
  medsCard: { marginHorizontal: 20 },
  medsRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medsCount: { fontSize: 28, fontWeight: '700', color: Colors.light.textPrimary },
  medsLabel: { fontSize: 13, color: Colors.light.textSecondary },
  medRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  medDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.semantic.warning },
  medName:   { fontSize: 14, color: Colors.light.textSecondary, flex: 1 },

  // Appointment
  apptCard: { marginHorizontal: 20 },
  apptRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptEmoji: { fontSize: 32 },
  apptInfo:  { flex: 1, gap: 2 },
  apptDoctor: { fontSize: 15, fontWeight: '700', color: Colors.light.textPrimary },
  apptSpec:   { fontSize: 13, color: Colors.light.textSecondary },
  apptDate:   { fontSize: 12, color: Colors.light.textMuted, marginTop: 4 },

  // Gamification
  gamifCard:   { marginHorizontal: 20 },
  gamifRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  gamifLevel:  { fontSize: 20, fontWeight: '700', color: Colors.light.textPrimary },
  gamifName:   { fontSize: 13, color: Colors.light.textSecondary },
  gamifRight:  { alignItems: 'flex-end', gap: 4 },
  gamifPoints: { fontSize: 16, fontWeight: '700', color: Colors.brand.primary },
  gamifStreak: { fontSize: 13, color: Colors.light.textSecondary },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    alignItems:       'center',
    paddingVertical:  20,
    gap:              6,
  },
  emptyEmoji:  { fontSize: 28 },
  emptyText:   { fontSize: 14, color: Colors.light.textMuted },
  emptyAction: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
})
