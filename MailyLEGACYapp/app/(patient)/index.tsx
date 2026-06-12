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
import { LinearGradient } from 'expo-linear-gradient'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card }          from '@components/ui/Card'
import { Skeleton }      from '@components/ui/Skeleton'
import { Avatar }        from '@components/ui/Avatar'
import { Colors }        from '@constants/colors'
import { get }           from '@lib/api/client'
import { EP }            from '@lib/api/endpoints'
import { useAuthStore }   from '@store/auth.store'
import { useWsStore }     from '@store/ws.store'
import { useVitalsLatest, VITAL_META } from '@hooks/useVitals'

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

const INSIGHT_TYPE_ICON: Record<string, string> = {
  MEDICATION_ADHERENCE: '💊',
  VITAL_TREND:          '📈',
  LAB_ANALYSIS:         '🔬',
  GENERAL_HEALTH:       '🧠',
}

// ── Tips rotativos ────────────────────────────────────────────────────────────
const HEALTH_TIPS = [
  { emoji: '💧', title: 'Hidratación', text: 'Bebe al menos 8 vasos de agua al día. La hidratación mejora la concentración y el estado de ánimo.' },
  { emoji: '🥦', title: 'Nutrición', text: 'Incluye vegetales de colores variados en cada comida para obtener diferentes antioxidantes y vitaminas.' },
  { emoji: '🚶', title: 'Movimiento', text: '30 minutos de caminata al día reducen el riesgo cardiovascular en un 35%. ¡Cada paso cuenta!' },
  { emoji: '😴', title: 'Sueño reparador', text: 'Dormir 7-9 horas mejora la memoria, el metabolismo y el sistema inmunológico.' },
  { emoji: '🧘', title: 'Manejo del estrés', text: '5 minutos de respiración profunda reducen el cortisol y mejoran la presión arterial.' },
  { emoji: '🫀', title: 'Salud cardíaca', text: 'Medir tu presión arterial regularmente es clave para prevenir enfermedades cardíacas silenciosas.' },
]

const STRETCHES = [
  { emoji: '🙆', title: 'Estiramiento de cuello', text: 'Inclina la cabeza hacia cada lado durante 15 segundos. Alivia la tensión acumulada.' },
  { emoji: '🤸', title: 'Apertura de pecho', text: 'Entrelaza tus manos detrás de la espalda y estira por 20 segundos. Mejora la postura.' },
  { emoji: '🧎', title: 'Cuádriceps', text: 'De pie, lleva el talón hacia los glúteos durante 20 segundos por pierna.' },
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
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
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
              { icon: '👤', label: 'Perfil',          route: '/(patient)/profile' },
              { icon: '🔔', label: 'Notificaciones',  route: '/(patient)/notifications', badge: unread },
              { icon: '👨‍👩‍👧', label: 'Familia',          route: '/(patient)/family-care' },
              { icon: '💳', label: 'Planes',           route: '/(patient)/plans' },
              { icon: '🎮', label: 'Mis logros',       route: '/(patient)/gamification' },
              { icon: '⚙️', label: 'Configuración',   route: '/(patient)/settings' },
              { icon: '💬', label: 'Soporte',          route: null },
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
                <Text style={styles.menuItemIcon}>{item.icon}</Text>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                {item.badge ? (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                ) : (
                  <Text style={styles.menuChevron}>›</Text>
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
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/(patient)/ai-chat')}
          style={styles.chatBtnWrap}
        >
          <LinearGradient
            colors={[Colors.brand.primary, '#0A7A6B']}
            style={styles.chatBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.chatBtnIcon}>🤖</Text>
            <View style={styles.chatBtnText}>
              <Text style={styles.chatBtnTitle}>Asistente IA de salud</Text>
              <Text style={styles.chatBtnSub}>Pregunta sobre tus datos, síntomas o medicamentos</Text>
            </View>
            <Text style={styles.chatArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Stats rápidas ── */}
        {isLoading ? (
          <Skeleton height={100} borderRadius={16} style={styles.mx} />
        ) : (
          <View style={styles.statsRow}>
            <StatCard
              emoji="💊"
              value={meds ? `${meds.taken}/${meds.total}` : '—'}
              label="Medicamentos"
              sub="tomados hoy"
              color="#6C63FF"
            />
            <StatCard
              emoji="🔥"
              value={streakDays > 0 ? `${streakDays}d` : '—'}
              label="Racha"
              sub="consecutivos"
              color="#F8A600"
            />
            <StatCard
              emoji="📊"
              value={adherence != null ? `${adherence}%` : '—'}
              label="Adherencia"
              sub="promedio"
              color={adherenceColor}
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
          <Card style={styles.vitalsCard}>
            <View style={styles.vitalsRow}>
              {vitalsLatest.slice(0, 4).map(v => {
                const meta = VITAL_META[v.vital_type]
                const display = v.vital_type === 'BLOOD_PRESSURE' && v.secondary_value != null
                  ? `${v.value}/${v.secondary_value}`
                  : `${v.value}`
                return (
                  <VitalChip key={v.vital_type} icon={meta?.icon ?? '📊'} value={display} unit={v.unit} label={meta?.label ?? v.vital_type} />
                )
              })}
            </View>
            <TouchableOpacity
              style={styles.addVitalBtn}
              onPress={() => router.push('/(patient)/vitals/add')}
              activeOpacity={0.7}
            >
              <Text style={styles.addVitalText}>+ Registrar nuevo signo vital</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <EmptyCard
            emoji="📊"
            text="Sin vitales registrados aún"
            action="Registrar primero"
            onAction={() => router.push('/(patient)/vitals/add')}
          />
        )}

        {/* ── Insight IA ── */}
        {latestInsight && (
          <>
            <SectionHeader title="Análisis IA de salud" />
            <Card style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightIcon}>
                  {INSIGHT_TYPE_ICON[latestInsight.insight_type] ?? '🧠'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle} numberOfLines={2}>{latestInsight.title}</Text>
                  <Text style={styles.insightDate}>
                    {new Date(latestInsight.generated_at.replace(/\.\d{1,6}(?=[+-Z]|$)/, ''))
                      .toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </View>
              <Text style={styles.insightBody} numberOfLines={4}>{latestInsight.content}</Text>
            </Card>
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
              <Card style={styles.apptCard}>
                <Text style={styles.apptEmoji}>📅</Text>
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
              </Card>
            </TouchableOpacity>
          </>
        )}

        {/* ── Tip del día ── */}
        <SectionHeader title="Consejo del día" />
        <Card style={styles.tipCard}>
          <Text style={styles.tipEmoji}>{todayTip.emoji}</Text>
          <View style={styles.tipText}>
            <Text style={styles.tipTitle}>{todayTip.title}</Text>
            <Text style={styles.tipBody}>{todayTip.text}</Text>
          </View>
        </Card>

        {/* ── Estiramiento del día ── */}
        <SectionHeader title="Estiramiento de hoy" />
        <Card style={styles.tipCard}>
          <Text style={styles.tipEmoji}>{todayStretch.emoji}</Text>
          <View style={styles.tipText}>
            <Text style={styles.tipTitle}>{todayStretch.title}</Text>
            <Text style={styles.tipBody}>{todayStretch.text}</Text>
          </View>
        </Card>

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
  emoji, value, label, sub, color,
}: { emoji: string; value: string; label: string; sub: string; color: string }) {
  return (
    <View style={sc.card}>
      <Text style={sc.emoji}>{emoji}</Text>
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
      <Text style={sc.sub}>{sub}</Text>
    </View>
  )
}

const sc = StyleSheet.create({
  card:  { flex: 1, alignItems: 'center', backgroundColor: Colors.light.surface, borderRadius: 16, paddingVertical: 14, gap: 3, marginHorizontal: 4 },
  emoji: { fontSize: 22 },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', color: Colors.light.textPrimary },
  sub:   { fontSize: 10, color: Colors.light.textMuted },
})

function VitalChip({ icon, value, unit, label }: { icon: string; value: string; unit: string; label?: string }) {
  return (
    <View style={vc.chip}>
      <Text style={vc.icon}>{icon}</Text>
      <Text style={vc.value}>{value}</Text>
      <Text style={vc.unit}>{unit}</Text>
      {label && <Text style={vc.label} numberOfLines={1}>{label}</Text>}
    </View>
  )
}

const vc = StyleSheet.create({
  chip:  { alignItems: 'center', gap: 2, flex: 1 },
  icon:  { fontSize: 20 },
  value: { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  unit:  { fontSize: 10, color: Colors.light.textMuted },
  label: { fontSize: 9, color: Colors.light.textMuted, textAlign: 'center' },
})

function EmptyCard({
  emoji, text, action, onAction,
}: { emoji: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <Card style={ec.card}>
      <Text style={ec.emoji}>{emoji}</Text>
      <Text style={ec.text}>{text}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={ec.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </Card>
  )
}

const ec = StyleSheet.create({
  card:   { marginHorizontal: 20, alignItems: 'center', paddingVertical: 20, gap: 6 },
  emoji:  { fontSize: 28 },
  text:   { fontSize: 14, color: Colors.light.textMuted },
  action: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
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
    borderRadius:      18,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  chatBtnIcon:  { fontSize: 28 },
  chatBtnText:  { flex: 1 },
  chatBtnTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  chatBtnSub:   { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  chatArrow:    { fontSize: 26, color: 'rgba(255,255,255,0.6)' },

  statsRow:    { flexDirection: 'row', marginHorizontal: 16, marginTop: 16 },

  vitalsCard:  { marginHorizontal: 20 },
  vitalsRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  addVitalBtn: { marginTop: 12, alignItems: 'center' },
  addVitalText:{ fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },

  apptCard: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptEmoji:{ fontSize: 32 },
  apptInfo: { flex: 1, gap: 2 },
  apptDoctor:{ fontSize: 15, fontWeight: '700', color: Colors.light.textPrimary },
  apptSpec:  { fontSize: 13, color: Colors.light.textSecondary },
  apptDate:  { fontSize: 12, color: Colors.light.textMuted, marginTop: 4 },

  tipCard:  { marginHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipEmoji: { fontSize: 30, marginTop: 2 },
  tipText:  { flex: 1, gap: 4 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary },
  tipBody:  { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },

  // Menú hamburguesa
  menuOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, overflow: 'hidden' },
  menuHeader:    { padding: 20, paddingBottom: 12, backgroundColor: Colors.dark.bg },
  menuUserName:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  menuUserEmail: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 2 },
  menuItem:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  menuItemIcon:  { fontSize: 20, width: 32 },
  menuItemLabel: { flex: 1, fontSize: 15, color: Colors.light.textPrimary, fontWeight: '500' },
  menuChevron:   { fontSize: 20, color: Colors.light.textMuted },
  menuBadge:     { backgroundColor: Colors.semantic.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  menuBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  menuClose:     { marginHorizontal: 20, marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.light.surface, alignItems: 'center' },
  menuCloseText: { fontSize: 15, fontWeight: '600', color: Colors.light.textSecondary },

  // AI insight
  insightCard: {
    marginHorizontal: 20,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.primary,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightIcon:   { fontSize: 26 },
  insightTitle:  { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary, lineHeight: 20 },
  insightDate:   { fontSize: 11, color: Colors.light.textMuted, marginTop: 2 },
  insightBody:   { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
})
