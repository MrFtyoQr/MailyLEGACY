/**
 * (patient)/gamification.tsx
 * Pantalla de gamificación: puntos, racha, nivel, badges ganados,
 * progreso de nivel, próximas insignias y catálogo de productos canjeables.
 */

import React, { useState, useMemo, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { refreshProfileAndCelebrate } from '@lib/gamification/refreshProfileAndCelebrate'
import { ScreenWrapper }  from '@components/layout/ScreenWrapper'
import { IconBadge }      from '@components/ui/IconBadge'
import { PointsCoin }     from '@components/ui/PointsCoin'
import { Button }         from '@components/ui/Button'
import { StreakFlame, StreakTrophy } from '@components/ui/StreakIcons'
import { InfoCard }       from '@components/ui/InfoCard'
import { EmptyState }     from '@components/ui/EmptyState'
import { LevelBadgeDisplay } from '@components/gamification/LevelBadgeDisplay'
import { BadgeImage } from '@components/gamification/BadgeImage'
import { CouponRedeemedModal } from '@components/gamification/CouponRedeemedModal'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'
import { Colors }         from '@constants/colors'
import { getCouponImage, getCouponSubtitle } from '@constants/couponImages'
import { MAX_LEVEL, getLevelProgressFromProfile } from '@constants/levelBadges'
import { LOCAL_COUPONS_ENABLED } from '@constants/config'
import {
  usePlayerProfile, useTransactions, useAvailableBadges, useRewardProducts,
  useRedeemReward, redeemErrorMessage, useEffectiveRedeemableBalance,
  useLocalCouponRedemptions,
  type EarnedBadge, type PointTransaction, type RewardProduct, type Badge,
  type RedemptionRecord,
} from '@hooks/useGamification'

// ── Labels de fuente de puntos ────────────────────────────────────────────────
const SOURCE_LABEL: Record<string, string> = {
  MEDICATION_TAKEN:   'Medicamento tomado',
  VITAL_LOGGED:       'Signo vital registrado',
  LAB_UPLOADED:       'Resultado lab subido',
  APPOINTMENT_KEPT:   'Cita completada',
  STREAK_BONUS:       'Bonus por racha',
  REFERRAL_COMPLETED: 'Referido completado',
  PROFILE_COMPLETED:  'Perfil completado',
  MILESTONE:          'Hito desbloqueado',
  MANUAL_ADJUSTMENT:  'Ajuste manual',
  REDEMPTION:         'Canje de cupón',
}

const SOURCE_ICON: Record<string, AppIconName> = {
  MEDICATION_TAKEN:   'pill',
  VITAL_LOGGED:       'stethoscope',
  LAB_UPLOADED:       'lab',
  APPOINTMENT_KEPT:   'calendar',
  STREAK_BONUS:       'fire',
  REFERRAL_COMPLETED: 'doctor',
  PROFILE_COMPLETED:  'check',
  MILESTONE:          'trophy',
  MANUAL_ADJUSTMENT:  'cog',
  REDEMPTION:         'gift',
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
  const code = locked?.code ?? item?.badge.code ?? ''
  const name = locked?.name ?? item?.badge.name ?? ''
  const isLocked = Boolean(locked)

  if (isLocked && !locked) return null
  if (!isLocked && !item) return null

  return (
    <View style={[styles.badgeChip, isLocked && styles.badgeLocked]}>
      <BadgeImage code={code} size={52} locked={isLocked} />
      <Text style={[styles.badgeName, isLocked && styles.badgeNameLocked]} numberOfLines={2}>
        {name}
      </Text>
      {isLocked ? (
        <Text style={[styles.badgeDate, styles.badgeDateLocked]}>
          {locked!.threshold} {BADGE_CATEGORY_HINT[locked!.category] ?? 'para desbloquear'}
        </Text>
      ) : (
        <Text style={styles.badgeDate}>{fmtDate(item!.earned_at)}</Text>
      )}
    </View>
  )
}

function TxRow({ item }: { item: PointTransaction }) {
  const plus = item.points > 0
  const icon = SOURCE_ICON[item.source]
  return (
    <View style={styles.txRow}>
      {icon && <IconBadge name={icon} size={16} style={styles.txBadge} />}
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

function CouponCard({
  item,
  balance,
  redeeming,
  onRedeem,
}: {
  item:      RewardProduct
  balance:   number
  redeeming: boolean
  onRedeem:  (item: RewardProduct) => void
}) {
  const localImage = getCouponImage(item.points_cost)
  const subtitle   = getCouponSubtitle(item.points_cost) ?? item.description
  const canAfford  = balance >= item.points_cost

  return (
    <View style={styles.couponCard}>
      {localImage ? (
        <Image source={localImage} style={styles.couponImage} resizeMode="contain" />
      ) : item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.couponImage} resizeMode="contain" />
      ) : (
        <View style={[styles.couponImage, styles.couponImagePlaceholder]}>
          <IconBadge name="gift" size={28} />
        </View>
      )}

      <View style={styles.couponBody}>
        <Text style={styles.couponName}>{item.name}</Text>
        {subtitle ? (
          <Text style={styles.couponSubtitle} numberOfLines={2}>{subtitle}</Text>
        ) : null}

        <View style={styles.couponFooter}>
          <View style={styles.rewardCostRow}>
            <PointsCoin size={16} />
            <Text style={styles.rewardCost}>
              {item.points_cost.toLocaleString('es-MX')} pts
            </Text>
          </View>

          <View style={styles.redeemBtnWrap}>
            <Button
              label={redeeming ? 'Canjeando…' : 'Canjear'}
              variant="primary"
              size="sm"
              loading={redeeming}
              disabled={!canAfford || redeeming}
              onPress={() => onRedeem(item)}
            />
          </View>
        </View>

        {!canAfford ? (
          <Text style={styles.couponHint}>
            Te faltan {(item.points_cost - balance).toLocaleString('es-MX')} pts
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function GamificationScreen() {
  const qc = useQueryClient()
  const { data: profile, isLoading: loadingProfile } = usePlayerProfile()
  const { data: txPage,  isLoading: loadingTx }      = useTransactions()
  const { data: badges }                             = useAvailableBadges()
  const {
    data: rewards,
    isLoading: loadingRewards,
    isError: rewardsError,
    refetch: refetchRewards,
    isRefetching: refetchingRewards,
  } = useRewardProducts()
  const redeemMutation                               = useRedeemReward()

  const [showAllTx, setShowAllTx] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [couponModal, setCouponModal] = useState<{
    reward:     RewardProduct
    redemption: RedemptionRecord
  } | null>(null)

  const { data: localRedemptions = [] } = useLocalCouponRedemptions()

  const transactions = useMemo(() => {
    const serverTx = txPage?.results ?? []
    if (!LOCAL_COUPONS_ENABLED || localRedemptions.length === 0) {
      return serverTx
    }
    const localTx: PointTransaction[] = localRedemptions.map((r) => ({
      id:             `local-${r.id}`,
      source:         'REDEMPTION',
      source_display: 'Canje de cupón',
      base_points:    -r.points_spent,
      multiplier:     1,
      points:         -r.points_spent,
      note:           `Canje ${r.code}: ${r.reward_name}`,
      created_at:     r.created_at,
    }))
    return [...localTx, ...serverTx].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [txPage?.results, localRedemptions])
  const visibleTx    = showAllTx ? transactions : transactions.slice(0, 10)
  const earnedBadges = profile?.badges ?? []
  const rewardList   = rewards?.results ?? []
  const balance      = useEffectiveRedeemableBalance(profile?.balance)

  const earnedCodes = useMemo(() => new Set(earnedBadges.map((eb) => eb.badge.code)), [earnedBadges])
  const allBadges   = badges?.results ?? []
  const locked      = allBadges.filter((b) => !earnedCodes.has(b.code))

  const levelProgress = useMemo(() => {
    if (!profile) return null
    return getLevelProgressFromProfile(profile)
  }, [profile])

  const confirmRedeem = useCallback((item: RewardProduct) => {
    Alert.alert(
      'Confirmar canje',
      `¿Canjear "${item.name}" por ${item.points_cost.toLocaleString('es-MX')} puntos?\n\nRecibirás un código único para usar tu descuento.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Canjear',
          onPress: async () => {
            setRedeemingId(item.id)
            try {
              const result = await redeemMutation.mutateAsync(item)
              setCouponModal({ reward: item, redemption: result.redemption })
            } catch (err) {
              Alert.alert('No se pudo canjear', redeemErrorMessage(err))
            } finally {
              setRedeemingId(null)
            }
          },
        },
      ],
    )
  }, [redeemMutation])

  const refreshGamification = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refreshProfileAndCelebrate(qc),
        refetchRewards(),
        qc.invalidateQueries({ queryKey: ['gamification-transactions'] }),
        qc.invalidateQueries({ queryKey: ['badges'] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [qc, refetchRewards])

  useFocusEffect(
    useCallback(() => {
      refreshProfileAndCelebrate(qc)
      refetchRewards()
    }, [qc, refetchRewards]),
  )

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Puntos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || refetchingRewards}
            onRefresh={refreshGamification}
            tintColor={Colors.brand.primary}
          />
        }
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
                <Text style={styles.heroPointsLabel}>Progreso de nivel</Text>
                <View style={styles.heroPointsRow}>
                  <PointsCoin size={24} />
                  <Text style={styles.heroPoints}>
                    {profile.level_points.toLocaleString('es-MX')}
                    {profile.level < MAX_LEVEL && profile.level_points_required > 0 ? (
                      <Text style={styles.heroPointsTotal}>
                        {' '}/ {profile.level_points_required.toLocaleString('es-MX')}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <Text style={styles.heroBalanceLabel}>Saldo canjeable</Text>
                <View style={styles.heroBalanceRow}>
                  <PointsCoin size={16} />
                  <Text style={styles.heroBalance}>
                    {balance.toLocaleString('es-MX')} pts
                  </Text>
                </View>
              </View>
              <LevelBadgeDisplay
                level={profile.level}
                imageSize={80}
                light
                showName={false}
              />
            </View>

            {/* Barra de progreso de nivel */}
            {levelProgress && (
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>
                    Nv. {profile.level} a Nv. {Math.min(profile.level + 1, MAX_LEVEL)}
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
                <View style={styles.heroStatRow}>
                  <StreakFlame size={20} />
                  <Text style={styles.heroStatVal}>{profile.current_streak}d</Text>
                </View>
                <Text style={styles.heroLabel}>racha actual</Text>
              </View>
              <View style={styles.heroStat}>
                <View style={styles.heroStatRow}>
                  <StreakTrophy size={20} />
                  <Text style={styles.heroStatVal}>{profile.longest_streak}d</Text>
                </View>
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
        <InfoCard style={styles.tipCard}>
          <View style={styles.tipCardInner}>
            <IconBadge name="camera" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>+10 pts por foto de evidencia</Text>
              <Text style={styles.tipText}>
                Al registrar un signo vital con foto obtienes 10 pts en vez de 5.
                ¡Adjunta una foto la próxima vez!
              </Text>
            </View>
          </View>
        </InfoCard>

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
              {locked.map((b) => (
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

        {/* ── Cupones canjeables ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Canjea tus puntos</Text>
            {rewardList.length > 0 && (
              <Text style={styles.sectionSub}>
                Saldo: {balance.toLocaleString('es-MX')} pts
              </Text>
            )}
          </View>
          {loadingRewards ? (
            <ActivityIndicator color={Colors.brand.primary} style={{ marginTop: 12 }} />
          ) : rewardsError && !LOCAL_COUPONS_ENABLED ? (
            <EmptyState
              icon="gift"
              title="No se pudieron cargar los cupones"
              subtitle="Verifica tu conexión e intenta de nuevo. Si el problema continúa, el catálogo puede no estar configurado en el servidor."
            />
          ) : rewardList.length === 0 ? (
            <EmptyState
              icon="gift"
              title={LOCAL_COUPONS_ENABLED ? 'Ya canjeaste todos tus cupones' : 'Sin cupones disponibles'}
              subtitle={
                LOCAL_COUPONS_ENABLED
                  ? 'Cada cupón solo se puede canjear una vez. Revisa tu historial para ver los códigos obtenidos.'
                  : 'Desliza hacia abajo para actualizar. Si acabas de instalar la app, los cupones se cargan al abrir esta pantalla.'
              }
            />
          ) : (
            rewardList.map((r) => (
              <CouponCard
                key={r.id}
                item={r}
                balance={balance}
                redeeming={redeemingId === r.id}
                onRedeem={confirmRedeem}
              />
            ))
          )}
        </View>

        {__DEV__ && (
          <TouchableOpacity
            onPress={() => router.push('/(patient)/dev/level-badges')}
            style={styles.devLabBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.devLabText}>Laboratorio de insignias (dev)</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <CouponRedeemedModal
        visible={couponModal !== null}
        reward={couponModal?.reward ?? null}
        redemption={couponModal?.redemption ?? null}
        image={couponModal ? getCouponImage(couponModal.reward.points_cost) : null}
        onClose={() => setCouponModal(null)}
      />
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
  heroPointsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  heroPoints: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#FFFFFF',
  },
  heroPointsTotal: {
    fontSize:   18,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.75)',
  },
  heroBalanceLabel: {
    fontSize:   11,
    color:      'rgba(255,255,255,0.65)',
    fontWeight: '500',
    marginTop:  10,
    marginBottom: 2,
  },
  heroBalanceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  heroBalance: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#FFE066',
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
  heroStatRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
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
    marginBottom: 0,
  },
  tipCardInner: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           12,
  },
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
    width:           96,
    backgroundColor: Colors.light.surface,
    borderRadius:    12,
    padding:         10,
    alignItems:      'center',
    gap:             4,
    marginRight:     10,
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  badgeLocked: { opacity: 0.92 },
  badgeNameLocked: { opacity: 0.55 },
  badgeDateLocked: { opacity: 0.5 },
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
    gap:              10,
  },
  txBadge: { flexShrink: 0 },
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

  // Cupones
  couponCard: {
    backgroundColor: Colors.light.surface,
    borderRadius:    16,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     Colors.light.border,
    marginBottom:    12,
  },
  couponImage: {
    width:           '100%',
    height:          120,
    backgroundColor: Colors.light.surface,
  },
  couponImagePlaceholder: {
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.border,
  },
  couponBody: {
    padding: 14,
    gap:     6,
  },
  couponName: {
    fontSize:   15,
    fontWeight: '800',
    color:      Colors.light.textPrimary,
  },
  couponSubtitle: {
    fontSize:   12,
    color:      Colors.light.textSecondary,
    lineHeight: 17,
  },
  couponFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      6,
  },
  couponHint: {
    fontSize:  11,
    color:     Colors.semantic.warning,
    marginTop: 2,
  },
  redeemBtnWrap: {
    minWidth: 108,
  },
  rewardCostRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  rewardCost:  {
    fontSize:   15,
    fontWeight: '800',
    color:      Colors.brand.primary,
  },

  devLabBtn: {
    marginTop:       4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.light.border,
    borderStyle:     'dashed',
    backgroundColor: Colors.light.surface,
    alignItems:      'center',
  },
  devLabText: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.light.textSecondary,
  },
})
