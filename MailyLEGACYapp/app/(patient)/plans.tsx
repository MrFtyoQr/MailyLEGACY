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
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { IconBadge } from '@components/ui/IconBadge'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'
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
  icon:  AppIconName
  accent: string
  faceColor: string
  shadowColor: string
  label: string
  priceIndividual: number
  priceFamily: number
}> = {
  FREE:     { icon: 'card',   accent: '#8E8E93', faceColor: '#F4F4F5', shadowColor: '#E4E4E7', label: 'Gratis',   priceIndividual: 0,     priceFamily: 0     },
  SILVER:   { icon: 'medal',  accent: '#5E9FE0', faceColor: '#EFF6FF', shadowColor: '#DBEAFE', label: 'Silver',   priceIndividual: 5.99,  priceFamily: 9.99  },
  GOLD:     { icon: 'trophy', accent: '#F5A623', faceColor: '#FFFBEB', shadowColor: '#FDE68A', label: 'Gold',     priceIndividual: 12.99, priceFamily: 19.99 },
  PLATINUM: { icon: 'star',   accent: '#9B59B6', faceColor: '#FAF5FF', shadowColor: '#E9D5FF', label: 'Platinum', priceIndividual: 24.99, priceFamily: 34.99 },
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
            <View style={styles.modeBtnInner}>
              <AppIcon
                name="user"
                size={14}
                color={mode === 'individual' ? Colors.dark.bg : 'rgba(255,255,255,0.7)'}
              />
              <Text style={[styles.modeBtnText, mode === 'individual' && styles.modeBtnTextActive]}>
                Individual
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'family' && styles.modeBtnActive]}
            onPress={() => setMode('family')}
            activeOpacity={0.8}
          >
            <View style={styles.modeBtnInner}>
              <AppIcon
                name="family"
                size={14}
                color={mode === 'family' ? Colors.dark.bg : 'rgba(255,255,255,0.7)'}
              />
              <Text style={[styles.modeBtnText, mode === 'family' && styles.modeBtnTextActive]}>
                Familiar
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {mode === 'family' && (
          <View style={styles.familyNote}>
            <AppIcon name="check" size={12} color={Colors.brand.nature} />
            <Text style={styles.familyNoteText}>
              Incluye hasta 6 miembros en el plan Platinum
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Plan actual badge ──────────────────────────────────────── */}
      {subscription?.plan && (
        <View style={styles.currentPlanBanner}>
          <IconBadge
            name={TIER_META[currentTier].icon}
            size={14}
            accent={TIER_META[currentTier].accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.currentPlanText}>
              Plan actual:{' '}
              <Text style={{ fontWeight: '700' }}>{subscription.plan.name}</Text>
            </Text>
            {subscription.currentPeriodEnd && (
              <Text style={styles.currentPlanSub}>
                Vigente hasta {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-MX')}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* ── Cards de planes ───────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {TIERS.map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            meta={TIER_META[tier]}
            price={getPrice(tier)}
            isCurrent={tier === currentTier}
            isSelected={selected === tier}
            isExpanded={expanded === tier}
            popular={tier === 'GOLD'}
            checkoutLoading={checkoutLoading && selected === tier}
            onToggle={() => {
              setSelected(tier)
              setExpanded(expanded === tier ? null : tier)
            }}
            onSubscribe={() => handleSubscribe(tier)}
          />
        ))}

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

// ─── Tarjeta de plan ──────────────────────────────────────────────────────────

function PlanCard({
  tier,
  meta,
  price,
  isCurrent,
  isSelected,
  isExpanded,
  popular,
  checkoutLoading,
  onToggle,
  onSubscribe,
}: {
  tier:            PlanTier
  meta:            typeof TIER_META[PlanTier]
  price:           number
  isCurrent:       boolean
  isSelected:      boolean
  isExpanded:      boolean
  popular:         boolean
  checkoutLoading: boolean
  onToggle:        () => void
  onSubscribe:     () => void
}) {
  const features = FEATURE_MATRIX[tier]
  const faceColor = isCurrent ? '#F0FDF4' : meta.faceColor
  const shadowColor = isCurrent ? '#BBF7D0' : meta.shadowColor

  return (
    <Card
      variant={isSelected && !isCurrent ? 'outlined' : 'default'}
      padding={0}
      faceColor={faceColor}
      shadowColor={shadowColor}
    >
      {popular && (
        <View style={styles.popularBadge}>
          <AppIcon name="star" size={12} color="#E8922A" />
          <Text style={styles.popularText}>Más popular</Text>
        </View>
      )}

      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <View style={styles.planHeader}>
          <IconBadge name={meta.icon} size={20} accent={meta.accent} />
          <View style={styles.planInfo}>
            <Text style={styles.planName}>{meta.label}</Text>
            {isCurrent && <Badge label="Activo" variant="success" size="sm" />}
          </View>
          <View style={styles.planPricing}>
            {price === 0 ? (
              <Text style={[styles.planPrice, { color: meta.accent }]}>Gratis</Text>
            ) : (
              <>
                <Text style={[styles.planPrice, { color: meta.accent }]}>
                  ${price.toFixed(2)}
                </Text>
                <Text style={styles.planPriceSub}>/mes</Text>
              </>
            )}
          </View>
          <AppIcon
            name="chevron-right"
            size={18}
            color={Colors.light.textMuted}
            style={isExpanded ? { transform: [{ rotate: '90deg' }] } : undefined}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.featureList}>
          <View style={styles.featureDivider} />
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <AppIcon
                name={f.included ? 'check' : 'close'}
                size={16}
                color={f.included ? Colors.semantic.success : Colors.light.textMuted}
              />
              <Text style={[
                styles.featureLabel,
                !f.included && styles.featureLabelDisabled,
                f.highlight && f.included && styles.featureLabelHighlight,
              ]}>
                {f.label}
              </Text>
            </View>
          ))}

          {!isCurrent && (
            <View style={styles.ctaWrap}>
              <Button
                label={tier === 'FREE' ? 'Continuar gratis' : `Contratar ${meta.label}`}
                variant={tier === 'FREE' ? 'secondary' : 'primary'}
                fullWidth
                loading={checkoutLoading}
                onPress={onSubscribe}
              />
            </View>
          )}
        </View>
      )}
    </Card>
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
  modeBtnInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
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
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     8,
    justifyContent: 'center',
  },
  familyNoteText: {
    fontSize: 12,
    color:    Colors.brand.nature,
  },

  // Current plan banner
  currentPlanBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    backgroundColor:   Colors.semantic.infoBg,
    paddingVertical:   10,
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

  // Popular badge
  popularBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    backgroundColor:   '#FEF3C7',
    paddingVertical:   6,
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
  planInfo:   { flex: 1, gap: 4 },
  planName: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
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

  // Features
  featureDivider: {
    height:          1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 16,
    marginBottom:    12,
  },
  featureList:  { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
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
  ctaWrap: {
    marginTop: 8,
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
