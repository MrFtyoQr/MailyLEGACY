/**
 * (patient)/vitals/index.tsx
 * Signos vitales — último valor por signo + historial colapsable.
 * Diseño: cabecera de última captura, grid de 14 signos con colores de estado,
 * puntos gamificación y acceso al historial.
 */

import React, { useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, RefreshControl, Dimensions,
} from 'react-native'
import { router, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper }    from '@components/layout/ScreenWrapper'
import { Skeleton }         from '@components/ui/Skeleton'
import { Button }           from '@components/ui/Button'
import { AppIcon }          from '@components/ui/AppIcon'
import { IconBadge }        from '@components/ui/IconBadge'
import { PointsCoin }       from '@components/ui/PointsCoin'
import { Colors }           from '@constants/colors'
import { DuoColors }        from '@constants/duoTheme'
import { get }              from '@lib/api/client'
import { EP }               from '@lib/api/endpoints'
import {
  useVitalsLatest, useVitals,
  VITAL_META, VITAL_TYPES_ORDERED,
  type VitalLatest, type VitalType,
} from '@hooks/useVitals'
import { getStatusBadge, getVitalStatus, getBmiStatus } from '@lib/vitals/statusColors'
import { formatVitalValue } from '@lib/vitals/formatValue'

const { width } = Dimensions.get('window')
const CARD_W    = (width - 48 - 10) / 2  // 2 columnas con padding + gap

// ── Tarjeta de IMC calculado ──────────────────────────────────────────────────
function BmiCard({ weight, height }: { weight?: number; height?: number }) {
  const hasBoth = weight != null && height != null && height > 0
  const bmi     = hasBoth ? weight! / Math.pow(height! / 100, 2) : null
  const bmiStr  = bmi != null ? formatVitalValue('BMI', bmi) : '—'

  let status = getBmiStatus(bmi)
  let label  = 'Sin datos'
  if (bmi != null) {
    if      (bmi < 18.5) label = 'Bajo peso'
    else if (bmi < 25)   label = 'Normal'
    else if (bmi < 30)   label = 'Sobrepeso'
    else                 label = 'Obesidad'
  }
  const badge = getStatusBadge(status)

  return (
    <View style={styles.vitalCard}>
      <IconBadge name="chart" size={18} color={badge.color} bgColor={badge.bg} />
      <Text style={[styles.vitalValue, { color: bmi != null ? badge.color : Colors.light.textMuted }]}>
        {bmiStr}
      </Text>
      <Text style={styles.vitalUnit}>kg/m²</Text>
      <Text style={styles.vitalName} numberOfLines={2}>IMC (calculado)</Text>
      {bmi != null && <Text style={styles.vitalTime}>{label}</Text>}
      {!hasBoth && (
        <Text style={[styles.vitalTime, { fontSize: 9 }]}>Registra peso y talla</Text>
      )}
    </View>
  )
}

// ── Componente tarjeta de un signo ────────────────────────────────────────────
function VitalSignCard({ type, latest }: { type: VitalType; latest?: VitalLatest }) {
  const meta      = VITAL_META[type]
  const valueStr  = formatVitalValue(type, latest?.value, latest?.secondary_value)
  const hasValue  = valueStr !== '—'
  const status    = hasValue
    ? getVitalStatus(type, Number(latest!.value), latest!.secondary_value)
    : 'muted' as const
  const badge     = getStatusBadge(status)
  const color     = badge.color

  return (
    <TouchableOpacity
      style={styles.vitalCard}
      onPress={() => router.push(`/(patient)/vitals/${type}` as any)}
      activeOpacity={0.75}
    >
      <IconBadge name={meta.icon} size={18} color={badge.color} bgColor={badge.bg} />
      <Text style={[styles.vitalValue, { color: hasValue ? color : Colors.light.textMuted }]}>
        {valueStr}
      </Text>
      <Text style={styles.vitalUnit}>{hasValue ? latest!.unit : meta.unit}</Text>
      <Text style={styles.vitalName} numberOfLines={2}>{meta.label}</Text>
      {hasValue && (
        <Text style={styles.vitalTime}>
          {new Date(latest!.recorded_at).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short',
          })}
        </Text>
      )}
      <Text style={styles.vitalChevron}>›</Text>
    </TouchableOpacity>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function VitalsScreen() {
  const [refreshing,     setRefreshing]     = useState(false)
  const [showHistory,    setShowHistory]    = useState(false)

  const { data: latest,  isLoading, refetch } = useVitalsLatest()
  const { data: history, refetch: refetchH }  = useVitals()

  // Puntos gamificación
  const { data: playerProfile } = useQuery({
    queryKey:  ['player-profile'],
    staleTime: 5 * 60 * 1000,
    queryFn:   () => get<{ total_points: number; balance: number; level: number; level_points: number; current_streak: number }>(EP.gamification)
                       .catch(() => null),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetch(), refetchH()])
    setRefreshing(false)
  }

  // Mapa tipo → último valor
  const latestMap: Record<string, VitalLatest> = {}
  latest?.forEach(l => { latestMap[l.vital_type] = l })

  // Última captura
  const lastCapture = latest && latest.length > 0
    ? latest.reduce((a, b) => a.recorded_at > b.recorded_at ? a : b)
    : null

  const totalRegistered = latest?.length ?? 0

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Signos Vitales</Text>
          {lastCapture && (
            <Text style={styles.lastCapture}>
              Última captura: {new Date(lastCapture.recorded_at).toLocaleDateString('es-MX', {
                day: '2-digit', month: 'long',
              })} · {new Date(lastCapture.recorded_at).toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          )}
        </View>
        <Button
          label="Registrar"
          size="sm"
          variant="primary"
          leftIcon={<AppIcon name="plus" size={14} color={DuoColors.button.primaryText} />}
          onPress={() => router.push('/(patient)/vitals/add')}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Resumen rápido + puntos */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{totalRegistered}</Text>
            <Text style={styles.statLabel}>signos con datos</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{14 - totalRegistered}</Text>
            <Text style={styles.statLabel}>sin registrar</Text>
          </View>
          {playerProfile && (
            <TouchableOpacity
              style={[styles.statChip, styles.statChipPoints]}
              onPress={() => router.push('/(patient)/gamification' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.pointsRow}>
                <PointsCoin size={16} />
                <Text style={[styles.statValue, { color: Colors.brand.primary }]}>
                  {playerProfile.level_points ?? playerProfile.total_points}
                </Text>
              </View>
              <Text style={styles.statLabel}>pts · Nv.{playerProfile.level}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Leyenda de colores */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.semantic.success }]} />
            <Text style={styles.legendText}>Normal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.semantic.warning }]} />
            <Text style={styles.legendText}>Límite</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.semantic.error }]} />
            <Text style={styles.legendText}>Fuera de rango</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.light.border }]} />
            <Text style={styles.legendText}>Sin datos</Text>
          </View>
        </View>

        {/* Grid de signos vitales */}
        {isLoading ? (
          <View style={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={110} borderRadius={14} style={{ width: CARD_W }} />
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {VITAL_TYPES_ORDERED.map(type => (
              <VitalSignCard
                key={type}
                type={type}
                latest={latestMap[type]}
              />
            ))}
            {/* IMC calculado a partir de peso + talla */}
            <BmiCard
              weight={latestMap['WEIGHT']?.value}
              height={latestMap['HEIGHT']?.value}
            />
          </View>
        )}

        {/* Historial colapsable */}
        <Button
          label={showHistory ? 'Ocultar historial' : 'Ver historial de registros'}
          variant={showHistory ? 'secondary' : 'primary'}
          fullWidth
          onPress={() => setShowHistory(v => !v)}
        />

        {showHistory && history && history.length > 0 && (
          <View style={styles.historyList}>
            {history.slice(0, 30).map(r => {
              const meta = VITAL_META[r.vital_type]
              const status = getVitalStatus(r.vital_type, r.value, r.secondary_value)
              const badge = getStatusBadge(status)
              const valStr = formatVitalValue(r.vital_type, r.value, r.secondary_value)
              return (
                <View key={r.id} style={styles.historyRow}>
                  <IconBadge name={meta?.icon ?? 'chart'} size={16} color={badge.color} bgColor={badge.bg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyName}>{meta?.label ?? r.vital_type}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(r.recorded_at).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })} · {new Date(r.recorded_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                    {r.notes && (
                      <Text style={styles.historyNotes} numberOfLines={1}>{r.notes}</Text>
                    )}
                  </View>
                  <View style={styles.historyValWrap}>
                    <Text style={[styles.historyVal, { color: badge.color }]}>{valStr}</Text>
                    <Text style={styles.historyUnit}>{r.unit}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {showHistory && (!history || history.length === 0) && (
          <Text style={styles.historyEmpty}>Sin registros en el historial aún.</Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },
  title:       { fontSize: 22, fontWeight: '800', color: Colors.light.textPrimary },
  lastCapture: { fontSize: 12, color: Colors.light.textMuted, marginTop: 3 },
  addBtn: {
    backgroundColor: Colors.brand.primary, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 2,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },

  statsRow:        { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1, backgroundColor: Colors.light.surface, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2,
  },
  statChipPoints:  { borderWidth: 1.5, borderColor: Colors.brand.primary + '40' },
  pointsRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue:       { fontSize: 18, fontWeight: '800', color: Colors.light.textPrimary },
  statLabel:       { fontSize: 10, color: Colors.light.textMuted, textAlign: 'center' },

  legend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.light.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },

  vitalCard: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  vitalValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  vitalUnit:  { fontSize: 10, color: Colors.light.textMuted },
  vitalName:  { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary, marginTop: 2 },
  vitalTime:    { fontSize: 10, color: Colors.light.textMuted },
  vitalChevron: { fontSize: 14, color: Colors.light.textMuted, alignSelf: 'flex-end', marginTop: 2 },

  historyList:  { gap: 1, borderRadius: 14, overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  historyName:    { fontSize: 13, fontWeight: '600', color: Colors.light.textPrimary },
  historyDate:    { fontSize: 11, color: Colors.light.textMuted, marginTop: 1 },
  historyNotes:   { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2, fontStyle: 'italic' },
  historyValWrap: { alignItems: 'flex-end', gap: 2 },
  historyVal:     { fontSize: 16, fontWeight: '700' },
  historyUnit:    { fontSize: 10, color: Colors.light.textMuted },
  historyEmpty:   { textAlign: 'center', color: Colors.light.textMuted, fontSize: 13, paddingVertical: 16 },
})
