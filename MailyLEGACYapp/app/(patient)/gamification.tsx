/**
 * (patient)/gamification.tsx
 * Pantalla de gamificación: puntos, racha, nivel, badges ganados,
 * progreso de nivel, próximas insignias y catálogo de productos canjeables.
 */

import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper }  from '@components/layout/ScreenWrapper'
import { Colors }         from '@constants/colors'
import {
  usePlayerProfile, useTransactions, useAvailableBadges, useRewardProducts,
  type EarnedBadge, type PointTransaction, type RewardProduct, type Badge,
} from '@hooks/useGamification'

// ── Niveles y umbrales ────────────────────────────────────────────────────────
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 4000, 8000, 15000, 30000]
const MAX_LEVEL = 10

function getLevelProgress(totalPoints: number, level: number) {
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextThreshold    = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  if (level >= MAX_LEVEL) return { pct: 1, current: totalPoints, needed: 0 }
  const range = nextThreshold - currentThreshold
  const done  = totalPoints  - currentThreshold
  return {
    pct:     Math.min(Math.max(done / range, 0), 1),
    current: done,
    needed:  nextThreshold - totalPoints,
  }
}

// ── Labels de fuente de puntos ────────────────────────────────────────────────
const SOURCE_LABEL: Record<string, string> = {
  MEDICATION_TAKEN:   '💊 Medicamento tomado',
  VITAL_LOGGED:       '🩺 Signo vital registrado',
  LAB_UPLOADED:       '🔬 Resultado lab subido',
  APPOINTMENT_KEPT:   '📅 Cita completada',
  STREAK_BONUS:       '🔥 Bonus por racha',
  REFERRAL_COMPLETED: '👨‍⚕️ Referido completado',
  PROFILE_COMPLETED:  '✅ Perfil completado',
  MILESTONE:          '🏆 Hito desbloqueado',
  MANUAL_ADJUSTMENT:  '⚙️ Ajuste manual',
}

// ── Hints de categoría de badge ───────────────────────────────────────────────
const BADGE_CATEGORY_HINT: Record<string, string> = {
  STREAK:    'días consecutivos de medicamento',
  ADHERENCE: 'medicamentos tomados',
  VITALS:    'vitales registrados',
  MILESTONE: 'puntos acumulados',
  SOCIAL:    'referidos completados',
}

function fmtDate(iso: string) {
  return new Date(iso.replace(/\.\d{1,6}(?=[+-Z]|$)/, '')).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function BadgeChip({ item, locked }: { item: EarnedBadge | null; locked?: Badge }) {
  if (locked) {
    return (
      <View style={[styles.badgeChip, styles.badgeLocked]}>
        <Text style={[styles.badgeEmoji, { opacity: 0.25 }]}>🔒</Text>
        <Text style={[styles.badgeName, { opacity: 0.4 }]} numberOfLines={2}>{locked.name}</Text>
        <Text style={[styles.badgeDate, { opacity: 0.4 }]}>
          {locked.threshold} {BADGE_CATEGORY_HINT[locked.category] ?? 'para desbloquear'}
        </Text>
      </View>
    )
  }
  if (!item) return null
  return (
    <View style={styles.badgeChip}>
      {item.badge.icon_url ? (
        <Image source={{ uri: item.badge.icon_url }} style={styles.badgeIcon} />
      ) : (
        <Text style={styles.badgeEmoji}>🏅</Text>
      )}
      <Text style={styles.badgeName} numberOfLines={2}>{item.badge.name}</Text>
      <Text style={styles.badgeDate}>{fmtDate(item.earned_at)}</Text>
    </View>
  )
}

function TxRow({ item }: { item: PointTransaction }) {
  const plus = item.points > 0
  return (
    <View style={styles.txRow}>
      <View style={styles.txLeft}>
        <Text style={styles.txLabel}>
          {SOURCE_LABEL[item.source] ?? item.source_display}
        </Text>
        {item.note ? (
          <Text style={styles.txNote}>{item.note}</Text>
        ) : null}
        <Text style={styles.txDate}>{fmtDate(item.created_at)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txPoints, { color: plus ? Colors.semantic.success : Colors.semantic.error }]}>
          {plus ? '+' : ''}{item.points} pts
        </Text>
        {item.multiplier > 1 && (
          <Text style={styles.txMultiplier}>×{item.multiplier}</Text>
        )}
      </View>
    </View>
  )
}

function RewardCard({ item }: { item: RewardProduct }) {
  const stockLabel = item.stock === 0 ? 'Ilimitado' : `${item.stock} disponibles`
  return (
    <View style={styles.rewardCard}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.rewardImage} />
      ) : (
        <View style={[styles.rewardImage, styles.rewardImagePlaceholder]}>
          <Text style={{ fontSize: 32 }}>🎁</Text>
        </View>
      )}
      <View style={styles.rewardInfo}>
        <Text style={styles.rewardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.rewardStock}>{stockLabel}</Text>
        <Text style={styles.rewardCost}>⭐ {item.points_cost} pts</Text>
      </View>
    </View>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function GamificationScreen() {
  const { data: profile, isLoading: loadingProfile } = usePlayerProfile()
  const { data: txPage,  isLoading: loadingTx }      = useTransactions()
  const { data: badges }                             = useAvailableBadges()
  const { data: rewards }                            = useRewardProducts()

  const [showAllTx, setShowAllTx] = useState(false)

  const transactions = txPage?.results ?? []
  const visibleTx    = showAllTx ? transactions : transactions.slice(0, 10)
  const earnedBadges = profile?.badges ?? []
  const rewardList   = rewards?.results ?? []

  const earnedCodes = useMemo(() => new Set(earnedBadges.map((eb) => eb.badge.code)), [earnedBadges])
  const allBadges   = badges?.results ?? []
  const locked      = allBadges.filter((b) => !earnedCodes.has(b.code))

  const levelProgress = useMemo(() => {
    if (!profile) return null
    return getLevelProgress(profile.total_points, profile.level)
  }, [profile])

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Puntos ⭐</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        {loadingProfile ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.brand.primary} />
          </View>
        ) : profile ? (
          <View style={styles.heroCard}>
            {/* Fila principal: puntos + nivel */}
            <View style={styles.heroMainRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroPointsLabel}>Puntos totales</Text>
                <Text style={styles.heroPoints}>⭐ {profile.total_points.toLocaleString('es-MX')}</Text>
              </View>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeNum}>{profile.level}</Text>
                <Text style={styles.levelBadgeLabel}>NIVEL</Text>
              </View>
            </View>

            {/* Barra de progreso de nivel */}
            {levelProgress && (
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>
                    Nv. {profile.level} → Nv. {Math.min(profile.level + 1, MAX_LEVEL)}
                  </Text>
                  {profile.level < MAX_LEVEL && (
                    <Text style={styles.progressLabel}>
                      {levelProgress.needed} pts para subir
                    </Text>
                  )}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, {
                    width: `${Math.round(levelProgress.pct * 100)}%` as `${number}%`,
                  }]} />
                </View>
              </View>
            )}

            {/* Fila secundaria: racha + multiplicador */}
            <View style={styles.heroDivider} />
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>🔥 {profile.current_streak}d</Text>
                <Text style={styles.heroLabel}>racha actual</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>🏆 {profile.longest_streak}d</Text>
                <Text style={styles.heroLabel}>racha récord</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatVal, profile.multiplier > 1 && styles.multiplierActive]}>
                  ×{profile.multiplier}
                </Text>
                <Text style={styles.heroLabel}>multiplicador</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Tip: foto de evidencia ── */}
        <View style={styles.tipCard}>
          <Text style={styles.tipEmoji}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>+10 pts por foto de evidencia</Text>
            <Text style={styles.tipText}>
              Al registrar un signo vital con foto obtienes 10 pts en vez de 5.
              ¡Adjunta una foto la próxima vez!
            </Text>
          </View>
        </View>

        {/* ── Insignias ganadas + bloqueadas ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Insignias</Text>
            {earnedBadges.length > 0 && (
              <Text style={styles.sectionSub}>
                {earnedBadges.length} ganada{earnedBadges.length > 1 ? 's' : ''} · {locked.length} por desbloquear
              </Text>
            )}
          </View>

          {earnedBadges.length === 0 && locked.length === 0 ? (
            <Text style={styles.empty}>Aún no hay insignias disponibles.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesRow}>
              {earnedBadges.map((eb) => (
                <BadgeChip key={eb.id} item={eb} />
              ))}
              {locked.slice(0, 5).map((b) => (
                <BadgeChip key={b.id} item={null} locked={b} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Historial de puntos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de puntos</Text>
          {loadingTx ? (
            <ActivityIndicator color={Colors.brand.primary} style={{ marginTop: 12 }} />
          ) : transactions.length === 0 ? (
            <Text style={styles.empty}>Aún no tienes transacciones.</Text>
          ) : (
            <View style={styles.txList}>
              {visibleTx.map((tx) => (
                <TxRow key={tx.id} item={tx} />
              ))}
              {transactions.length > 10 && (
                <TouchableOpacity
                  onPress={() => setShowAllTx((v) => !v)}
                  style={styles.showMoreBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>
                    {showAllTx ? 'Ver menos' : `Ver todo (${transactions.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── Productos canjeables ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Canjea tus puntos 🎁</Text>
          {rewardList.length === 0 ? (
            <View style={styles.rewardPlaceholder}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🎁</Text>
              <Text style={styles.rewardPlaceholderTitle}>Próximamente</Text>
              <Text style={styles.rewardPlaceholderText}>
                Podrás canjear tus puntos por productos y beneficios de salud.
              </Text>
            </View>
          ) : (
            rewardList.map((r) => <RewardCard key={r.id} item={r} />)
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   Colors.light.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  back:  { fontSize: 28, color: Colors.light.textPrimary, width: 40, lineHeight: 32 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },

  scroll: { padding: 16, gap: 16 },
  center: { alignItems: 'center', paddingVertical: 32 },

  // Hero card
  heroCard: {
    backgroundColor: Colors.brand.primary,
    borderRadius:    20,
    padding:         20,
    gap:             14,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  heroPointsLabel: {
    fontSize: 12,
    color:    'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 2,
  },
  heroPoints: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#FFFFFF',
  },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius:    16,
    paddingHorizontal: 16,
    paddingVertical:   10,
    alignItems:      'center',
    minWidth:        64,
  },
  levelBadgeNum: {
    fontSize:   26,
    fontWeight: '900',
    color:      '#FFFFFF',
    lineHeight: 30,
  },
  levelBadgeLabel: {
    fontSize:   9,
    fontWeight: '700',
    color:      'rgba(255,255,255,0.8)',
    letterSpacing: 1.2,
    marginTop:  2,
  },

  // Level progress
  progressSection: { gap: 6 },
  progressLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize:   11,
    color:      'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  progressTrack: {
    height:          8,
    borderRadius:    4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow:        'hidden',
  },
  progressFill: {
    height:          8,
    borderRadius:    4,
    backgroundColor: '#FFFFFF',
  },

  heroDivider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroStatsRow: {
    flexDirection:  'row',
    justifyContent: 'space-around',
  },
  heroStat: {
    alignItems: 'center',
    gap:        3,
  },
  heroStatVal: {
    fontSize:   18,
    fontWeight: '700',
    color:      '#FFFFFF',
  },
  multiplierActive: {
    color: '#FFE066',
  },
  heroLabel: {
    fontSize:   11,
    color:      'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // Tip card
  tipCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             12,
    backgroundColor: Colors.semantic.successBg ?? '#EFF9F0',
    borderRadius:    14,
    padding:         14,
    borderWidth:     1,
    borderColor:     Colors.semantic.success + '30',
  },
  tipEmoji: { fontSize: 24 },
  tipTitle: {
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.semantic.success,
    marginBottom: 2,
  },
  tipText: {
    fontSize: 12,
    color:    Colors.light.textSecondary,
    lineHeight: 17,
  },

  // Sections
  section: { gap: 8 },
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  sectionTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    color:    Colors.light.textMuted,
  },

  // Badges
  badgesRow: { flexDirection: 'row' },
  badgeChip: {
    width:           88,
    backgroundColor: Colors.light.surface,
    borderRadius:    12,
    padding:         10,
    alignItems:      'center',
    gap:             4,
    marginRight:     10,
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  badgeLocked: { opacity: 0.7 },
  badgeIcon:   { width: 36, height: 36, borderRadius: 8 },
  badgeEmoji:  { fontSize: 28 },
  badgeName:   {
    fontSize:   11,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  badgeDate: {
    fontSize:  10,
    color:     Colors.light.textMuted,
    textAlign: 'center',
  },

  // Transactions
  txList: {
    backgroundColor: '#fff',
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.light.border,
    overflow:        'hidden',
  },
  txRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:  12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  txLeft:  { flex: 1, gap: 2 },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  txNote: {
    fontSize: 12,
    color:    Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  txDate:       { fontSize: 11, color: Colors.light.textMuted },
  txPoints:     { fontSize: 15, fontWeight: '700' },
  txMultiplier: { fontSize: 10, color: Colors.light.textMuted },

  showMoreBtn: { alignItems: 'center', paddingVertical: 12 },
  showMoreText: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
  empty: {
    fontSize:      14,
    color:         Colors.light.textMuted,
    textAlign:     'center',
    paddingVertical: 16,
  },

  // Rewards
  rewardPlaceholder: {
    backgroundColor: Colors.light.surface,
    borderRadius:    16,
    padding:         32,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     Colors.light.border,
    borderStyle:     'dashed',
  },
  rewardPlaceholderTitle: {
    fontSize:     16,
    fontWeight:   '700',
    color:        Colors.light.textPrimary,
    marginBottom: 4,
  },
  rewardPlaceholderText: {
    fontSize:  13,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
  },
  rewardCard: {
    flexDirection:   'row',
    backgroundColor: Colors.light.surface,
    borderRadius:    16,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     Colors.light.border,
    marginBottom:    10,
  },
  rewardImage:            { width: 88, height: 88 },
  rewardImagePlaceholder: {
    backgroundColor: Colors.light.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rewardInfo:  { flex: 1, padding: 12, gap: 4 },
  rewardName:  {
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  rewardStock: { fontSize: 12, color: Colors.light.textSecondary },
  rewardCost:  {
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.brand.primary,
    marginTop:  4,
  },
})
