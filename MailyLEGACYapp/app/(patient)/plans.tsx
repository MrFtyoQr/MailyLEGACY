/**
 * (patient)/plans.tsx
 * -------------------
 * Pantalla de selección de plan de suscripción.
 * Muestra planes FREE / SILVER / GOLD / PLATINUM en modo individual o familiar.
 * El botón "Mejorar" del perfil navega aquí.
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors } from '@constants/colors'
import {
  usePlans,
  useSubscription,
  useCheckout,
  FEATURE_MATRIX,
  type PlanTier,
  type PlanMode,
  type Plan,
} from '@hooks/usePlans'

// ─── Constantes visuales por tier ─────────────────────────────────────────────

const TIER_META: Record<PlanTier, {
  icon: string
  gradient: readonly [string, string]
  label: string
  priceIndividual: number
  priceFamily: number
}> = {
  FREE:     { icon: '🆓', gradient: ['#8E8E93', '#6B6B72'], label: 'Gratis',    priceIndividual: 0,    priceFamily: 0    },
  SILVER:   { icon: '🥈', gradient: ['#5E9FE0', '#3B7DC4'], label: 'Silver',    priceIndividual: 5.99, priceFamily: 9.99 },
  GOLD:     { icon: '🥇', gradient: ['#F5A623', '#E8922A'], label: 'Gold',      priceIndividual: 12.99,priceFamily: 19.99},
  PLATINUM: { icon: '💎', gradient: ['#9B59B6', '#7D3C98'], label: 'Platinum',  priceIndividual: 24.99,priceFamily: 34.99},
}

const TIERS: PlanTier[] = ['FREE', 'SILVER', 'GOLD', 'PLATINUM']

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PlansScreen() {
  const [mode, setMode]           = useState<PlanMode>('individual')
  const [selected, setSelected]   = useState<PlanTier | null>(null)
  const [expanded, setExpanded]   = useState<PlanTier | null>('GOLD')

  const { data: backendPlans }    = usePlans()
  const { data: subscription }    = useSubscription()
  const { mutate: startCheckout, isPending: checkoutLoading } = useCheckout()

  const currentTier = subscription?.plan?.tier ?? 'FREE'

  /** Encuentra el plan del backend que coincide con tier+mode, si existe */
  const findBackendPlan = useCallback(
    (tier: PlanTier): Plan | undefined =>
      backendPlans?.find((p) => p.tier === tier && p.mode === mode),
    [backendPlans, mode],
  )

  function getPrice(tier: PlanTier): number {
    const backend = findBackendPlan(tier)
    if (backend) return backend.priceMonthly
    return mode === 'individual'
      ? TIER_META[tier].priceIndividual
      : TIER_META[tier].priceFamily
  }

  function handleSubscribe(tier: PlanTier) {
    if (tier === 'FREE') {
      Alert.alert('Plan Gratuito', 'Ya estás en el plan gratuito o puedes descargar la app sin costo.')
      return
    }
    if (tier === currentTier) {
      Alert.alert('Plan actual', 'Ya tienes este plan activo.')
      return
    }

    const backend = findBackendPlan(tier)
    if (backend) {
      startCheckout(
        { planId: backend.id },
        {
          onSuccess: ({ checkoutUrl }) => {
            Linking.openURL(checkoutUrl).catch(() =>
              Alert.alert('Error', 'No se pudo abrir el enlace de pago.'),
            )
          },
          onError: () => {
            Alert.alert('Error', 'No se pudo iniciar el pago. Intenta más tarde.')
          },
        },
      )
    } else {
      // Sin backend disponible — info de contacto
      Alert.alert(
        `Contratar ${TIER_META[tier].label}`,
        'Para suscribirte contacta a nuestro equipo desde la app o escríbenos a soporte@mailytcuida.com',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar email', onPress: () => Linking.openURL('mailto:soporte@mailytcuida.com') },
        ],
      )
    }
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0A0F1E', '#131B2E']}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planes de suscripción</Text>
        <Text style={styles.headerSub}>
          Elige el plan que mejor se adapte a tu familia
        </Text>

        {/* Toggle individual / familiar */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'individual' && styles.modeBtnActive]}
            onPress={() => setMode('individual')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'individual' && styles.modeBtnTextActive]}>
              👤 Individual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'family' && styles.modeBtnActive]}
            onPress={() => setMode('family')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'family' && styles.modeBtnTextActive]}>
              👨‍👩‍👧 Familiar
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'family' && (
          <Text style={styles.familyNote}>
            ✓ Incluye hasta 6 miembros en el plan Platinum
          </Text>
        )}
      </LinearGradient>

      {/* ── Plan actual badge ──────────────────────────────────────── */}
      {subscription?.plan && (
        <View style={styles.currentPlanBanner}>
          <Text style={styles.currentPlanText}>
            {TIER_META[currentTier].icon} Plan actual:{' '}
            <Text style={{ fontWeight: '700' }}>{subscription.plan.name}</Text>
          </Text>
          {subscription.currentPeriodEnd && (
            <Text style={styles.currentPlanSub}>
              Vigente hasta {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-MX')}
            </Text>
          )}
        </View>
      )}

      {/* ── Cards de planes ───────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {TIERS.map((tier) => {
          const meta      = TIER_META[tier]
          const price     = getPrice(tier)
          const isCurrent = tier === currentTier
          const isSelected = selected === tier
          const isExpanded = expanded === tier
          const features  = FEATURE_MATRIX[tier]
          const popular   = tier === 'GOLD'

          return (
            <TouchableOpacity
              key={tier}
              activeOpacity={0.9}
              onPress={() => {
                setSelected(tier)
                setExpanded(isExpanded ? null : tier)
              }}
              style={[
                styles.planCard,
                isCurrent   && styles.planCardCurrent,
                isSelected  && !isCurrent && styles.planCardSelected,
                popular     && !isCurrent && styles.planCardPopular,
              ]}
            >
              {/* Popular badge */}
              {popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>⭐ Más popular</Text>
                </View>
              )}

              {/* Plan header */}
              <View style={styles.planHeader}>
                <LinearGradient
                  colors={meta.gradient}
                  style={styles.planIconBg}
                >
                  <Text style={styles.planIcon}>{meta.icon}</Text>
                </LinearGradient>

                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{meta.label}</Text>
                  {isCurrent && (
                    <View style={styles.activeChip}>
                      <Text style={styles.activeChipText}>Activo</Text>
                    </View>
                  )}
                </View>

                <View style={styles.planPricing}>
                  {price === 0 ? (
                    <Text style={[styles.planPrice, { color: meta.gradient[0] }]}>Gratis</Text>
                  ) : (
                    <>
                      <Text style={[styles.planPrice, { color: meta.gradient[0] }]}>
                        ${price.toFixed(2)}
                      </Text>
                      <Text style={styles.planPriceSub}>/mes</Text>
                    </>
                  )}
                </View>

                <Text style={[styles.expandChevron, isExpanded && { transform: [{ rotate: '90deg' }] }]}>
                  ›
                </Text>
              </View>

              {/* Features expandibles */}
              {isExpanded && (
                <View style={styles.featureList}>
                  <View style={styles.featureDivider} />
                  {features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Text style={[
                        styles.featureCheck,
                        f.included ? { color: Colors.semantic.success } : { color: Colors.light.textMuted },
                      ]}>
                        {f.included ? '✓' : '✕'}
                      </Text>
                      <Text style={[
                        styles.featureLabel,
                        !f.included && styles.featureLabelDisabled,
                        f.highlight && f.included && styles.featureLabelHighlight,
                      ]}>
                        {f.label}
                      </Text>
                    </View>
                  ))}

                  {/* CTA */}
                  {!isCurrent && (
                    <TouchableOpacity
                      style={[styles.ctaBtn, { backgroundColor: meta.gradient[0] }]}
                      onPress={() => handleSubscribe(tier)}
                      activeOpacity={0.85}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading && selected === tier ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.ctaBtnText}>
                          {tier === 'FREE' ? 'Continuar gratis' : `Contratar ${meta.label}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        {/* Nota legal */}
        <Text style={styles.legalNote}>
          Los precios están en USD. Los planes se renuevan automáticamente cada mes.
          Puedes cancelar en cualquier momento desde tu perfil.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     24,
    gap:               4,
  },
  backBtn: {
    width:  36,
    height: 36,
    justifyContent: 'center',
    marginBottom: 4,
  },
  backIcon: { fontSize: 28, color: '#fff', lineHeight: 32 },
  headerTitle: {
    fontSize:   24,
    fontWeight: '800',
    color:      '#fff',
    marginTop:  2,
  },
  headerSub: {
    fontSize: 14,
    color:    'rgba(255,255,255,0.65)',
    marginBottom: 16,
  },

  // Mode toggle
  modeToggle: {
    flexDirection:    'row',
    backgroundColor:  'rgba(255,255,255,0.12)',
    borderRadius:     12,
    padding:          3,
    marginTop:        4,
  },
  modeBtn: {
    flex:            1,
    paddingVertical: 8,
    alignItems:      'center',
    borderRadius:    10,
  },
  modeBtnActive: {
    backgroundColor: '#fff',
  },
  modeBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.7)',
  },
  modeBtnTextActive: {
    color: Colors.dark.bg,
  },
  familyNote: {
    fontSize:  12,
    color:     Colors.brand.nature,
    marginTop: 8,
    textAlign: 'center',
  },

  // Current plan banner
  currentPlanBanner: {
    backgroundColor: Colors.semantic.infoBg,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  currentPlanText: {
    fontSize: 13,
    color:    Colors.semantic.info,
  },
  currentPlanSub: {
    fontSize:  11,
    color:     Colors.light.textMuted,
    marginTop: 2,
  },

  // Scroll
  scroll: {
    padding:    16,
    gap:        12,
  },

  // Plan card
  planCard: {
    backgroundColor: '#fff',
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     Colors.light.border,
    overflow:        'hidden',
  },
  planCardCurrent: {
    borderColor:     Colors.semantic.success,
    backgroundColor: '#F0FDF4',
  },
  planCardSelected: {
    borderColor: Colors.brand.primary,
  },
  planCardPopular: {
    borderColor: '#F5A623',
  },

  // Popular badge
  popularBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 5,
    alignItems:      'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5A623',
  },
  popularText: {
    fontSize:   12,
    fontWeight: '700',
    color:      '#E8922A',
  },

  // Plan header row
  planHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    padding:        16,
  },
  planIconBg: {
    width:         46,
    height:        46,
    borderRadius:  12,
    justifyContent: 'center',
    alignItems:    'center',
  },
  planIcon:   { fontSize: 22 },
  planInfo:   { flex: 1, gap: 3 },
  planName: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  activeChip: {
    alignSelf:       'flex-start',
    backgroundColor: Colors.semantic.successBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius:    6,
  },
  activeChipText: {
    fontSize:   10,
    fontWeight: '700',
    color:      Colors.semantic.success,
  },
  planPricing:  { alignItems: 'flex-end' },
  planPrice: {
    fontSize:   20,
    fontWeight: '800',
  },
  planPriceSub: {
    fontSize: 11,
    color:    Colors.light.textMuted,
    marginTop: -2,
  },
  expandChevron: {
    fontSize:  22,
    color:     Colors.light.textMuted,
    marginLeft: 4,
  },

  // Features
  featureDivider: {
    height:          1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 16,
    marginBottom:    12,
  },
  featureList:  { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureCheck: { fontSize: 13, fontWeight: '700', width: 16, marginTop: 1 },
  featureLabel: {
    fontSize:  13,
    color:     Colors.light.textPrimary,
    flex:      1,
    lineHeight: 18,
  },
  featureLabelDisabled: {
    color:            Colors.light.textMuted,
    textDecorationLine: 'line-through',
  },
  featureLabelHighlight: {
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },

  // CTA
  ctaBtn: {
    marginTop:       16,
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
  },
  ctaBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#fff',
  },

  // Legal
  legalNote: {
    fontSize:   11,
    color:      Colors.light.textMuted,
    textAlign:  'center',
    lineHeight: 16,
    paddingHorizontal: 8,
    marginTop:  4,
  },
})
