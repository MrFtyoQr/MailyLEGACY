/**
 * (patient)/index.tsx
 * Home del paciente — saludo, stats del dashboard, tips de salud y acceso al chat IA.
 */

import React, { useMemo, useState, useEffect } from 'react'
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card }          from '@components/ui/Card'
import { InfoCard }      from '@components/ui/InfoCard'
import { IconBadge }     from '@components/ui/IconBadge'
import { Button }        from '@components/ui/Button'
import { Capsule3D }     from '@components/ui/Capsule3D'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'
import { Skeleton }      from '@components/ui/Skeleton'
import { Avatar }        from '@components/ui/Avatar'
import { Colors }        from '@constants/colors'
import { DuoColors }     from '@constants/duoTheme'
import { getIconColors, PASTEL, adherencePastel } from '@constants/iconColors'
import { get }           from '@lib/api/client'
import { EP }            from '@lib/api/endpoints'
import { useAuthStore }   from '@store/auth.store'
import { useWsStore }     from '@store/ws.store'
import { useVitalsLatest, VITAL_META, type VitalType } from '@hooks/useVitals'
import { getStatusBadge, getVitalStatus } from '@lib/vitals/statusColors'

const { width } = Dimensions.get('window')

// ── Tipos del dashboard de analytics ─────────────────────────────────────────
interface DashboardData {
  vitals_summary?: {
    heart_rate?:    number | null
    glucose_mgdl?:  number | null
    systolic_bp?:   number | null
    diastolic_bp?:  number | null
    weight_kg?:     number | null
    severity?:      string | null
  }
  medications_today?: {
    total:  number
    taken:  number
    missed: number
  }
  next_appointment?: {
    id:           string
    doctor_name:  string
    specialty:    string
    scheduled_at: string
  } | null
  streak_days?: number
  adherence_pct?: number
}

interface HealthInsight {
  id:            string
  insight_type:  'MEDICATION_ADHERENCE' | 'VITAL_TREND' | 'LAB_ANALYSIS' | 'GENERAL_HEALTH'
  title:         string
  content:       string
  generated_at:  string
}

const INSIGHT_TYPE_ICON: Record<string, AppIconName> = {
  MEDICATION_ADHERENCE: 'pill',
  VITAL_TREND:          'trend',
  LAB_ANALYSIS:         'lab',
  GENERAL_HEALTH:       'brain',
}

const HEALTH_TIPS: { icon: AppIconName; title: string; text: string }[] = [
  { icon: 'droplet',    title: 'Hidratación',       text: 'Bebe al menos 8 vasos de agua al día. La hidratación mejora la concentración y el estado de ánimo.' },
  { icon: 'nutrition',  title: 'Nutrición',         text: 'Incluye vegetales de colores variados en cada comida para obtener diferentes antioxidantes y vitaminas.' },
  { icon: 'walk',       title: 'Movimiento',        text: '30 minutos de caminata al día reducen el riesgo cardiovascular en un 35%. ¡Cada paso cuenta!' },
  { icon: 'sleep',      title: 'Sueño reparador',   text: 'Dormir 7-9 horas mejora la memoria, el metabolismo y el sistema inmunológico.' },
  { icon: 'meditation', title: 'Manejo del estrés', text: '5 minutos de respiración profunda reducen el cortisol y mejoran la presión arterial.' },
  { icon: 'heart',      title: 'Salud cardíaca',    text: 'Medir tu presión arterial regularmente es clave para prevenir enfermedades cardíacas silenciosas.' },
]

const STRETCHES: { icon: AppIconName; title: string; text: string }[] = [
  { icon: 'stretch-neck',  title: 'Estiramiento de cuello', text: 'Inclina la cabeza hacia cada lado durante 15 segundos. Alivia la tensión acumulada.' },
  { icon: 'stretch-chest', title: 'Apertura de pecho',      text: 'Entrelaza tus manos detrás de la espalda y estira por 20 segundos. Mejora la postura.' },
  { icon: 'stretch-quad',  title: 'Cuádriceps',             text: 'De pie, lleva el talón hacia los glúteos durante 20 segundos por pierna.' },
]

function getDayGreeting(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function PatientHome() {
  const user       = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const unread     = useWsStore((s) => s.unreadCount)
  const [menuVisible, setMenuVisible] = useState(false)

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey:  ['analytics-dashboard'],
    staleTime: 3 * 60 * 1000,
    queryFn:   () => get<DashboardData>(EP.analyticsDashboard),
  })

  // Si el nombre no está en el store (edge case de inicio rápido),
  // lo cargamos directamente desde /auth/me/ y actualizamos el store.
  useEffect(() => {
    if (!user?.firstName && !user?.lastName) {
      get<{ user: { id: string; email: string; role: string }; profile: { first_name?: string; last_name?: string; photo_url?: string } | null }>(EP.authMe)
        .then(me => {
          if (me.profile?.first_name || me.profile?.last_name) {
            updateUser({
              firstName: me.profile?.first_name ?? null,
              lastName:  me.profile?.last_name  ?? null,
              photoUrl:  me.profile?.photo_url  ?? null,
            })
          }
        })
        .catch(() => { /* silencioso */ })
    }
  }, [user?.firstName, user?.lastName])

  const hour       = new Date().getHours()
  const greeting   = getDayGreeting(hour)
  // Mostrar solo el primer nombre en el saludo, no el nombre completo
  const firstName  = user?.firstName ?? (user?.lastName ?? 'Paciente')

  // Tip del día rotativo por día del mes
  const todayTip    = useMemo(() => HEALTH_TIPS[new Date().getDate() % HEALTH_TIPS.length], [])
  const todayStretch = useMemo(() => STRETCHES[new Date().getDate() % STRETCHES.length], [])

  const { data: vitalsLatest } = useVitalsLatest()

  const { data: insightsData } = useQuery<{ results: HealthInsight[] }>({
    queryKey:  ['analytics-insights'],
    staleTime: 10 * 60 * 1000,
    queryFn:   () => get<{ results: HealthInsight[] }>(EP.analyticsInsights),
    retry:     false,
  })
  const latestInsight = insightsData?.results?.[0] ?? null

  const meds     = dashboard?.medications_today
  const nextAppt = dashboard?.next_appointment
  const streakDays = dashboard?.streak_days ?? 0
  const adherence  = dashboard?.adherence_pct ?? null

  const adherenceColor = adherence == null
    ? Colors.light.textMuted
    : adherence >= 80 ? Colors.semantic.success
    : adherence >= 50 ? Colors.semantic.warning
    : Colors.semantic.error

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar uri={user?.photoUrl} name={firstName} size={46} bgColor={Colors.brand.primary} />
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
            <Text style={styles.subGreeting}>¿Cómo te encuentras hoy?</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => setMenuVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.hamburger}>
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </View>
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Menú hamburguesa ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuUserName}>{user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Mi cuenta'}</Text>
              <Text style={styles.menuUserEmail}>{user?.email ?? ''}</Text>
            </View>
            {[
              { icon: 'user'     as AppIconName, label: 'Perfil',          route: '/(patient)/profile' },
              { icon: 'bell'     as AppIconName, label: 'Notificaciones',  route: '/(patient)/notifications', badge: unread },
              { icon: 'family'   as AppIconName, label: 'Familia',          route: '/(patient)/family-care' },
              { icon: 'card'     as AppIconName, label: 'Planes',           route: '/(patient)/plans' },
              { icon: 'trophy'   as AppIconName, label: 'Mis logros',       route: '/(patient)/gamification' },
              { icon: 'settings' as AppIconName, label: 'Configuración',   route: '/(patient)/settings' },
              { icon: 'chat'     as AppIconName, label: 'Soporte',          route: null },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false)
                  if (item.route) router.push(item.route as never)
                }}
              >
                <View style={styles.menuItemIconWrap}>
                  <AppIcon name={item.icon} size={20} color={Colors.brand.primary} />
                </View>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                {item.badge ? (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                ) : (
                  <AppIcon name="chevron-right" size={18} color={Colors.light.textMuted} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.menuClose} onPress={() => setMenuVisible(false)}>
              <Text style={styles.menuCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Chat IA ── */}
        <Capsule3D
          pressable
          onPress={() => router.push('/(patient)/ai-chat')}
          faceColor="#0A6E7A"
          shadowColor="#064E56"
          borderRadius={18}
          style={styles.chatBtnWrap}
          faceStyle={styles.chatBtn}
        >
          <View style={styles.chatIconCircle}>
            <AppIcon name="robot" size={26} color="#0A6E7A" />
          </View>
          <View style={styles.chatBtnText}>
            <Text style={styles.chatBtnTitle}>Asistente IA de salud</Text>
            <Text style={styles.chatBtnSub}>Pregunta sobre tus datos, síntomas o medicamentos</Text>
          </View>
          <AppIcon name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
        </Capsule3D>

        {/* ── Stats rápidas ── */}
        {isLoading ? (
          <Skeleton height={100} borderRadius={16} style={styles.mx} />
        ) : (
          <View style={styles.statsRow}>
            <StatCard
              icon="pill"
              value={meds ? `${meds.taken}/${meds.total}` : '—'}
              label="Medicamentos"
              sub="tomados hoy"
              accent="purple"
            />
            <StatCard
              icon="fire"
              value={streakDays > 0 ? `${streakDays}d` : '—'}
              label="Racha"
              sub="consecutivos"
              accent="orange"
            />
            <StatCard
              icon="chart"
              value={adherence != null ? `${adherence}%` : '—'}
              label="Adherencia"
              sub="promedio"
              accent="dynamic"
              dynamicColor={adherenceColor}
            />
          </View>
        )}

        {/* ── Vitales recientes ── */}
        <SectionHeader
          title="Últimos vitales"
          onAction={() => router.push('/(patient)/vitals')}
          actionLabel="Ver más"
        />
        {isLoading ? (
          <Skeleton height={96} borderRadius={16} style={styles.mx} />
        ) : vitalsLatest && vitalsLatest.length > 0 ? (
          <Card style={styles.vitalsCard} faceColor="#FFFFFF" shadowColor="#E8ECF0">
            <View style={styles.vitalsRow}>
              {vitalsLatest.slice(0, 4).map(v => {
                const meta = VITAL_META[v.vital_type]
                const display = v.vital_type === 'BLOOD_PRESSURE' && v.secondary_value != null
                  ? `${v.value}/${v.secondary_value}`
                  : `${v.value}`
                return (
                  <VitalChip
                    key={v.vital_type}
                    icon={meta?.icon ?? 'chart'}
                    value={display}
                    unit={v.unit}
                    label={meta?.label ?? v.vital_type}
                    vitalType={v.vital_type}
                    rawValue={v.value}
                    secondaryValue={v.secondary_value}
                  />
                )
              })}
            </View>
            <View style={styles.addVitalWrap}>
              <Button
                label="Registrar nuevo signo vital"
                size="sm"
                variant="primary"
                fullWidth
                leftIcon={<AppIcon name="plus" size={16} color={DuoColors.button.primaryText} />}
                onPress={() => router.push('/(patient)/vitals/add')}
              />
            </View>
          </Card>
        ) : (
          <EmptyCard
            icon="chart"
            text="Sin vitales registrados aún"
            action="Registrar primero"
            onAction={() => router.push('/(patient)/vitals/add')}
          />
        )}

        {/* ── Insight IA ── */}
        {latestInsight && (
          <>
            <SectionHeader title="Análisis IA de salud" />
            <InfoCard style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <IconBadge
                  name={INSIGHT_TYPE_ICON[latestInsight.insight_type] ?? 'brain'}
                  size={20}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle} numberOfLines={2}>{latestInsight.title}</Text>
                  <Text style={styles.insightDate}>
                    {new Date(latestInsight.generated_at.replace(/\.\d{1,6}(?=[+-Z]|$)/, ''))
                      .toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </View>
              <Text style={styles.insightBody} numberOfLines={4}>{latestInsight.content}</Text>
            </InfoCard>
          </>
        )}

        {/* ── Próxima cita ── */}
        {nextAppt && (
          <>
            <SectionHeader
              title="Próxima cita"
              onAction={() => router.push('/(patient)/appointments/index')}
              actionLabel="Agenda"
            />
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/(patient)/appointments/[id]', params: { id: nextAppt.id } })}
            >
              <InfoCard style={styles.apptCard}>
                <View style={styles.apptRow}>
                  <IconBadge name="calendar" size={22} />
                <View style={styles.apptInfo}>
                  <Text style={styles.apptDoctor} numberOfLines={1}>{nextAppt.doctor_name}</Text>
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
              </InfoCard>
            </TouchableOpacity>
          </>
        )}

        {/* ── Tip del día ── */}
        <SectionHeader title="Consejo del día" />
        <TipCard icon={todayTip.icon} title={todayTip.title} text={todayTip.text} />

        {/* ── Estiramiento del día ── */}
        <SectionHeader title="Estiramiento de hoy" />
        <TipCard icon={todayStretch.icon} title={todayStretch.title} text={todayStretch.text} />

        <View style={{ height: 120 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
    marginBottom:      8,
    paddingHorizontal: 20,
  },
  title:  { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  action: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
})

function StatCard({
  icon, value, label, sub, accent, dynamicColor,
}: { icon: AppIconName; value: string; label: string; sub: string; accent: keyof typeof PASTEL | 'dynamic'; dynamicColor?: string }) {
  const pastel = accent === 'dynamic'
    ? adherencePastel(dynamicColor ?? '#64748B')
    : PASTEL[accent as keyof typeof PASTEL]

  return (
    <View style={sc.wrap}>
      <Capsule3D
        faceColor="#FFFFFF"
        shadowColor="#E8ECF0"
        depth="sm"
        borderRadius={16}
        faceStyle={sc.face}
      >
        <IconBadge name={icon} size={20} color={pastel.icon} bgColor={pastel.bg} />
        <Text style={sc.value}>{value}</Text>
        <Text style={sc.label}>{label}</Text>
        <Text style={sc.sub}>{sub}</Text>
      </Capsule3D>
    </View>
  )
}

const sc = StyleSheet.create({
  wrap:  { flex: 1, marginHorizontal: 4 },
  face:  { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, gap: 4 },
  value: { fontSize: 20, fontWeight: '800', color: Colors.light.textPrimary },
  label: { fontSize: 11, fontWeight: '700', color: Colors.light.textPrimary },
  sub:   { fontSize: 10, color: Colors.light.textMuted },
})

function VitalChip({
  icon, value, unit, label, vitalType, rawValue, secondaryValue,
}: {
  icon: AppIconName
  value: string
  unit: string
  label?: string
  vitalType: VitalType
  rawValue: number
  secondaryValue?: number | null
}) {
  const badge = getStatusBadge(getVitalStatus(vitalType, rawValue, secondaryValue))
  return (
    <View style={vc.chip}>
      <IconBadge name={icon} size={18} color={badge.color} bgColor={badge.bg} />
      <Text style={[vc.value, { color: badge.color }]}>{value}</Text>
      <Text style={vc.unit}>{unit}</Text>
      {label && <Text style={vc.label} numberOfLines={1}>{label}</Text>}
    </View>
  )
}

const vc = StyleSheet.create({
  chip:  { alignItems: 'center', gap: 4, flex: 1 },
  value: { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  unit:  { fontSize: 10, color: Colors.light.textMuted },
  label: { fontSize: 9, color: Colors.light.textMuted, textAlign: 'center' },
})

function EmptyCard({
  icon, text, action, onAction,
}: { icon: AppIconName; text: string; action?: string; onAction?: () => void }) {
  return (
    <InfoCard style={ec.card}>
      <IconBadge name={icon} size={24} />
      <Text style={ec.text}>{text}</Text>
      {action && onAction && (
        <Button label={action} size="sm" variant="primary" onPress={onAction} />
      )}
    </InfoCard>
  )
}

const ec = StyleSheet.create({
  card: { marginHorizontal: 20, alignItems: 'center', paddingVertical: 8, gap: 10 },
  text: { fontSize: 14, color: Colors.light.textMuted, fontWeight: '500', textAlign: 'center' },
})

function TipCard({ icon, title, text }: { icon: AppIconName; title: string; text: string }) {
  return (
    <InfoCard style={tc.card}>
      <IconBadge name={icon} size={22} />
      <View style={tc.textCol}>
        <Text style={tc.title}>{title}</Text>
        <Text style={tc.body}>{text}</Text>
      </View>
    </InfoCard>
  )
}

const tc = StyleSheet.create({
  card:    { marginHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  textCol: { flex: 1, gap: 4 },
  title:   { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary },
  body:    { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting:   { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  subGreeting:{ fontSize: 13, color: Colors.light.textSecondary, marginTop: 1 },
  bellBtn:    { padding: 4, position: 'relative' },
  hamburger:  { gap: 5, paddingHorizontal: 2, paddingVertical: 4 },
  hamburgerLine: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: Colors.light.textPrimary },
  bellBadge:  {
    position: 'absolute', top: 0, right: 0,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.semantic.error,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  scroll:  { flex: 1 },
  content: { paddingBottom: 24 },
  mx:      { marginHorizontal: 20 },

  chatBtnWrap: { marginHorizontal: 20, marginTop: 4 },
  chatBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  chatIconCircle: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
  },
  chatBtnText:  { flex: 1 },
  chatBtnTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  chatBtnSub:   { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 2 },

  statsRow:    { flexDirection: 'row', marginHorizontal: 16, marginTop: 16 },

  vitalsCard:  { marginHorizontal: 20 },
  vitalsRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  addVitalWrap:{ marginTop: 14, alignItems: 'center' },

  apptCard: { marginHorizontal: 20 },
  apptRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptInfo: { flex: 1, gap: 2 },
  apptDoctor:{ fontSize: 15, fontWeight: '700', color: Colors.light.textPrimary },
  apptSpec:  { fontSize: 13, color: Colors.light.textSecondary },
  apptDate:  { fontSize: 12, color: Colors.light.textMuted, marginTop: 4 },

  // Menú hamburguesa
  menuOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, overflow: 'hidden' },
  menuHeader:    { padding: 20, paddingBottom: 12, backgroundColor: Colors.dark.bg },
  menuUserName:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  menuUserEmail: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 2 },
  menuItem:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  menuItemIconWrap: { width: 32, alignItems: 'center' },
  menuItemLabel: { flex: 1, fontSize: 15, color: Colors.light.textPrimary, fontWeight: '500' },
  menuBadge:     { backgroundColor: Colors.semantic.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  menuBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  menuClose:     { marginHorizontal: 20, marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.light.surface, alignItems: 'center' },
  menuCloseText: { fontSize: 15, fontWeight: '600', color: Colors.light.textSecondary },

  // AI insight
  insightCard: {
    marginHorizontal: 20,
    gap: 10,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightTitle:  { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary, lineHeight: 20 },
  insightDate:   { fontSize: 11, color: Colors.light.textMuted, marginTop: 2 },
  insightBody:   { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
})
