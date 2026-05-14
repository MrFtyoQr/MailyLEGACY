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
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper }    from '@components/layout/ScreenWrapper'
import { Skeleton }         from '@components/ui/Skeleton'
import { Colors }           from '@constants/colors'
import { get }              from '@lib/api/client'
import { EP }               from '@lib/api/endpoints'
import {
  useVitalsLatest, useVitals,
  VITAL_META, VITAL_TYPES_ORDERED,
  type VitalLatest, type VitalType,
} from '@hooks/useVitals'

const { width } = Dimensions.get('window')
const CARD_W    = (width - 48 - 10) / 2  // 2 columnas con padding + gap

// ── Colores de estado ─────────────────────────────────────────────────────────
function statusColor(type: VitalType, value: number): string {
  const meta = VITAL_META[type]
  if (!meta) return Colors.light.textMuted
  if (value < meta.normal.min || value > meta.normal.max) return Colors.semantic.error
  const span   = meta.normal.max - meta.normal.min
  const margin = span * 0.1
  if (value < meta.normal.min + margin || value > meta.normal.max - margin) return Colors.semantic.warning
  return Colors.semantic.success
}

// ── Componente tarjeta de un signo ────────────────────────────────────────────
function VitalSignCard({ type, latest }: { type: VitalType; latest?: VitalLatest }) {
  const meta      = VITAL_META[type]
  const hasValue  = !!latest
  const color     = hasValue ? statusColor(type, latest!.value) : Colors.light.textMuted
  const valueStr  = hasValue
    ? type === 'BLOOD_PRESSURE' && latest!.secondary_value != null
      ? `${latest!.value}/${latest!.secondary_value}`
      : `${latest!.value}`
    : '—'

  return (
    <View style={[styles.vitalCard, hasValue && { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={styles.vitalIcon}>{meta.icon}</Text>
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
    </View>
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
    queryFn:   () => get<{ points: number; level: number; streak: number }>(EP.gamificationProfile)
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
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(patient)/vitals/add')}
          activeOpacity={0.75}
        >
          <Text style={styles.addBtnText}>+ Registrar</Text>
        </TouchableOpacity>
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
            <View style={[styles.statChip, styles.statChipPoints]}>
              <Text style={[styles.statValue, { color: Colors.brand.primary }]}>
                ⭐ {playerProfile.points}
              </Text>
              <Text style={styles.statLabel}>puntos</Text>
            </View>
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
          </View>
        )}

        {/* Historial colapsable */}
        <TouchableOpacity
          style={styles.historyToggle}
          onPress={() => setShowHistory(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.historyToggleText}>
            {showHistory ? '▲ Ocultar historial' : '▼ Ver historial de registros'}
          </Text>
        </TouchableOpacity>

        {showHistory && history && history.length > 0 && (
          <View style={styles.historyList}>
            {history.slice(0, 30).map(r => {
              const meta = VITAL_META[r.vital_type]
              const color = statusColor(r.vital_type, r.value)
              const valStr = r.vital_type === 'BLOOD_PRESSURE' && r.secondary_value != null
                ? `${r.value}/${r.secondary_value}`
                : `${r.value}`
              return (
                <View key={r.id} style={styles.historyRow}>
                  <Text style={styles.historyIcon}>{meta?.icon ?? '📊'}</Text>
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
                      <Text style={styles.historyNotes} numberOfLines={1}>📝 {r.notes}</Text>
                    )}
                  </View>
                  <View style={styles.historyValWrap}>
                    <Text style={[styles.historyVal, { color }]}>{valStr}</Text>
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
  vitalIcon:  { fontSize: 22 },
  vitalValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  vitalUnit:  { fontSize: 10, color: Colors.light.textMuted },
  vitalName:  { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary, marginTop: 2 },
  vitalTime:  { fontSize: 10, color: Colors.light.textMuted },

  historyToggle: {
    backgroundColor: Colors.light.surface, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center',
  },
  historyToggleText: { fontSize: 13, fontWeight: '600', color: Colors.brand.primary },

  historyList:  { gap: 1, borderRadius: 14, overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  historyIcon:    { fontSize: 20, marginTop: 1 },
  historyName:    { fontSize: 13, fontWeight: '600', color: Colors.light.textPrimary },
  historyDate:    { fontSize: 11, color: Colors.light.textMuted, marginTop: 1 },
  historyNotes:   { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2, fontStyle: 'italic' },
  historyValWrap: { alignItems: 'flex-end', gap: 2 },
  historyVal:     { fontSize: 16, fontWeight: '700' },
  historyUnit:    { fontSize: 10, color: Colors.light.textMuted },
  historyEmpty:   { textAlign: 'center', color: Colors.light.textMuted, fontSize: 13, paddingVertical: 16 },
})
