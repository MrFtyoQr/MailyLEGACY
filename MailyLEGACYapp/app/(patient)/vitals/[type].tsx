/**
 * (patient)/vitals/[type].tsx
 * Detalle + historial gráfico de un signo vital.
 * Gráfica de barras con Views puras — sin react-native-svg ni deps externas.
 */

import React, { useMemo, useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions, Image, Modal, Pressable,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors } from '@constants/colors'
import {
  useVitals, useVitalsLatest,
  VITAL_META, type VitalType, type VitalReading,
} from '@hooks/useVitals'

const { width } = Dimensions.get('window')
const CHART_W    = width - 48
const CHART_H    = 160
const BAR_RADIUS = 4

// ── Helpers de color ──────────────────────────────────────────────────────────
function getColor(value: number, meta: typeof VITAL_META[VitalType]): string {
  if (value < meta.normal.min || value > meta.normal.max) return Colors.semantic.error
  const span   = meta.normal.max - meta.normal.min
  const margin = span * 0.1
  if (value < meta.normal.min + margin || value > meta.normal.max - margin)
    return Colors.semantic.warning
  return Colors.semantic.success
}

// ── Gráfica de barras con Views ───────────────────────────────────────────────
function BarChart({
  readings, meta,
}: {
  readings: { value: number; date: string }[]
  meta: typeof VITAL_META[VitalType]
}) {
  if (readings.length === 0) {
    return (
      <View style={chartStyles.empty}>
        <Text style={chartStyles.emptyText}>Sin registros suficientes para mostrar gráfica.</Text>
      </View>
    )
  }

  const vals = readings.map(r => r.value)

  // Escala: siempre incluye el rango normal + 15% de margen extra
  const dataMin = Math.min(...vals)
  const dataMax = Math.max(...vals)
  const yMin = Math.min(dataMin, meta.normal.min) * 0.88
  const yMax = Math.max(dataMax, meta.normal.max) * 1.12
  const range = yMax - yMin || 1

  // Posición de la banda de rango normal (desde arriba)
  const bandTop = ((yMax - meta.normal.max) / range) * CHART_H
  const bandH   = Math.max(((meta.normal.max - meta.normal.min) / range) * CHART_H, 2)

  // Ancho de barras adaptativo
  const BAR_W   = Math.min(Math.floor((CHART_W - 48) / Math.max(readings.length, 1)) - 3, 26)
  const BAR_GAP = Math.max(Math.floor((CHART_W - 48 - readings.length * BAR_W) / (readings.length + 1)), 2)

  // Etiquetas eje Y
  const yLabels = [
    { label: `${Math.round(yMax)}`, top: 0 },
    { label: `${Math.round((yMax + yMin) / 2)}`, top: CHART_H / 2 - 7 },
    { label: `${Math.round(yMin)}`, top: CHART_H - 14 },
  ]

  return (
    <View style={{ width: CHART_W }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Eje Y */}
        <View style={{ width: 38, height: CHART_H, justifyContent: 'space-between', paddingVertical: 0 }}>
          {yLabels.map((l, i) => (
            <Text key={i} style={chartStyles.yLabel}>{l.label}</Text>
          ))}
        </View>

        {/* Área de barras */}
        <View style={{ flex: 1, height: CHART_H, position: 'relative', overflow: 'hidden' }}>
          {/* Líneas horizontales guía */}
          <View style={[chartStyles.gridLine, { top: 0 }]} />
          <View style={[chartStyles.gridLine, { top: CHART_H / 2 }]} />
          <View style={[chartStyles.gridLine, { top: CHART_H - 1 }]} />

          {/* Banda de rango normal */}
          <View style={[chartStyles.normalBand, { top: bandTop, height: bandH }]} />
          {/* Línea superior del rango */}
          <View style={[chartStyles.guideLine, { top: bandTop }]}>
            <Text style={chartStyles.rangeLineLabel}>{meta.normal.max}</Text>
          </View>
          {/* Línea inferior del rango */}
          <View style={[chartStyles.guideLine, { top: bandTop + bandH }]}>
            <Text style={chartStyles.rangeLineLabel}>{meta.normal.min}</Text>
          </View>

          {/* Barras */}
          <View style={[chartStyles.barsRow, readings.length <= 3 && { justifyContent: 'center' }]}>
            {readings.map((r, i) => {
              const heightPct = (r.value - yMin) / range
              const barH      = Math.max(heightPct * CHART_H, 4)
              const color     = getColor(r.value, meta)
              return (
                <View key={i} style={[chartStyles.barWrap, { width: BAR_W, marginHorizontal: BAR_GAP / 2 }]}>
                  {/* Valor encima de la barra si hay pocas lecturas */}
                  {readings.length <= 5 && (
                    <Text style={[chartStyles.barLabel, { color }]}>{r.value}</Text>
                  )}
                  <View style={{ height: barH, width: BAR_W, backgroundColor: color, borderRadius: BAR_RADIUS }} />
                </View>
              )
            })}
          </View>
        </View>
      </View>

      {/* Etiquetas eje X */}
      <View style={{ marginLeft: 38 }}>
        {readings.length >= 2 ? (
          <View style={chartStyles.xLabels}>
            {[0, Math.floor((readings.length - 1) / 2), readings.length - 1].map((idx, i) => (
              <Text key={i} style={chartStyles.xLabel}>
                {new Date(readings[idx].date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={[chartStyles.xLabel, { textAlign: 'center', marginTop: 6 }]}>
            {new Date(readings[0].date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        )}
      </View>
    </View>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function VitalDetailScreen() {
  const { type }    = useLocalSearchParams<{ type: string }>()
  const vitalType   = type as VitalType
  const meta        = VITAL_META[vitalType]

  const [photoModal, setPhotoModal] = useState<string | null>(null)

  const { data: history, isLoading } = useVitals({ type: vitalType })
  const { data: latest }             = useVitalsLatest()
  const latestForType                = latest?.find(l => l.vital_type === vitalType)

  const chartData = useMemo(() => {
    if (!history) return []
    return [...history].slice(0, 20).reverse().map(r => ({
      value: Number(r.value),
      date:  r.recorded_at,
    }))
  }, [history])

  const statusColor = useMemo(() => {
    if (!latestForType || !meta) return Colors.light.textMuted
    return getColor(Number(latestForType.value), meta)
  }, [latestForType, meta])

  const currentValueStr = latestForType
    ? vitalType === 'BLOOD_PRESSURE' && latestForType.secondary_value != null
      ? `${latestForType.value}/${latestForType.secondary_value}`
      : `${latestForType.value}`
    : '—'

  if (!meta) {
    return (
      <ScreenWrapper edges={['top', 'left', 'right']}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16 }}>
          <Text style={{ color: Colors.brand.primary }}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.empty}>Signo vital no reconocido.</Text>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      {/* Modal de foto a tamaño completo */}
      <Modal
        visible={photoModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPhotoModal(null)}>
          <Image
            source={{ uri: photoModal ?? '' }}
            style={styles.modalImage}
            resizeMode="contain"
          />
          <Text style={styles.modalClose}>✕ Cerrar</Text>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{meta.icon} {meta.label}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Valor actual */}
        <View style={[styles.currentCard, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.currentLabel}>Último registro</Text>
            {latestForType && (
              <Text style={styles.currentDate}>
                {new Date(latestForType.recorded_at).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.currentValue, { color: statusColor }]}>
              {currentValueStr}
            </Text>
            <Text style={styles.currentUnit}>{meta.unit}</Text>
          </View>
        </View>

        {/* Rangos */}
        <View style={styles.rangeRow}>
          <View style={styles.rangeChip}>
            <Text style={styles.rangeLabel}>Mínimo</Text>
            <Text style={styles.rangeValue}>{meta.normal.min}</Text>
            <Text style={styles.rangeUnit}>{meta.unit}</Text>
          </View>
          <View style={[styles.rangeChip, styles.rangeChipNormal]}>
            <Text style={[styles.rangeLabel, { color: Colors.semantic.success }]}>Normal</Text>
            <Text style={[styles.rangeValue, { color: Colors.semantic.success }]}>
              {meta.normal.min}–{meta.normal.max}
            </Text>
            <Text style={styles.rangeUnit}>{meta.unit}</Text>
          </View>
          <View style={styles.rangeChip}>
            <Text style={styles.rangeLabel}>Máximo</Text>
            <Text style={styles.rangeValue}>{meta.normal.max}</Text>
            <Text style={styles.rangeUnit}>{meta.unit}</Text>
          </View>
        </View>

        {/* Gráfica */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Últimas 20 lecturas</Text>
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: Colors.semantic.success }]} />
              <Text style={styles.legendText}>Normal</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.semantic.warning }]} />
              <Text style={styles.legendText}>Límite</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.semantic.error }]} />
              <Text style={styles.legendText}>Fuera</Text>
            </View>
          </View>
          {isLoading ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={Colors.brand.primary} />
          ) : (
            <BarChart readings={chartData} meta={meta} />
          )}
        </View>

        {/* Historial */}
        <Text style={styles.sectionTitle}>Historial completo</Text>
        {isLoading ? (
          <ActivityIndicator color={Colors.brand.primary} />
        ) : !history || history.length === 0 ? (
          <Text style={styles.empty}>Sin registros todavía.</Text>
        ) : (
          <View style={styles.historyList}>
            {history.slice(0, 50).map((r: VitalReading) => {
              const v      = Number(r.value)
              const col    = getColor(v, meta)
              const valStr = vitalType === 'BLOOD_PRESSURE' && r.secondary_value != null
                ? `${r.value}/${r.secondary_value}`
                : `${r.value}`

              return (
                <View key={r.id} style={styles.historyRow}>
                  <View style={[styles.historyIndicator, { backgroundColor: col }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>
                      {new Date(r.recorded_at).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}{' · '}
                      {new Date(r.recorded_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                    {r.notes ? (
                      <Text style={styles.historyNotes} numberOfLines={1}>📝 {r.notes}</Text>
                    ) : null}
                  </View>
                  {r.photo_url ? (
                    <TouchableOpacity onPress={() => setPhotoModal(r.photo_url!)} activeOpacity={0.8}>
                      <Image source={{ uri: r.photo_url }} style={styles.historyThumb} />
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.historyValWrap}>
                    <Text style={[styles.historyVal, { color: col }]}>{valStr}</Text>
                    <Text style={styles.historyUnit}>{r.unit}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

// ── Estilos gráfica ───────────────────────────────────────────────────────────
const chartStyles = StyleSheet.create({
  empty: {
    height: CHART_H, alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: Colors.light.textMuted, textAlign: 'center' },
  yLabel:    { fontSize: 9, color: Colors.light.textMuted, textAlign: 'right', paddingRight: 4 },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1, backgroundColor: Colors.light.border,
  },
  normalBand: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: Colors.semantic.success + '1A',
  },
  guideLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1, backgroundColor: Colors.semantic.success + '70',
  },
  rangeLineLabel: {
    position: 'absolute', right: 2, top: -10,
    fontSize: 8, color: Colors.semantic.success, fontWeight: '600',
  },
  barsRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  barWrap: {
    alignItems: 'center', justifyContent: 'flex-end', height: CHART_H,
  },
  barLabel: { fontSize: 8, fontWeight: '700', marginBottom: 1 },
  xLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 2, marginTop: 5,
  },
  xLabel: { fontSize: 10, color: Colors.light.textMuted },
})

// ── Estilos pantalla ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
  },
  back:  { fontSize: 17, color: Colors.brand.primary, fontWeight: '600', minWidth: 60 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary, flex: 1, textAlign: 'center' },

  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },

  currentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  currentLabel: { fontSize: 12, color: Colors.light.textMuted, fontWeight: '500' },
  currentDate:  { fontSize: 11, color: Colors.light.textMuted, marginTop: 2 },
  currentValue: { fontSize: 36, fontWeight: '800' },
  currentUnit:  { fontSize: 12, color: Colors.light.textMuted },

  rangeRow:  { flexDirection: 'row', gap: 8 },
  rangeChip: {
    flex: 1, backgroundColor: Colors.light.surface, borderRadius: 10,
    padding: 10, alignItems: 'center', gap: 2,
  },
  rangeChipNormal: { backgroundColor: Colors.semantic.success + '15' },
  rangeLabel: { fontSize: 10, color: Colors.light.textMuted },
  rangeValue: { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary },
  rangeUnit:  { fontSize: 10, color: Colors.light.textMuted },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, gap: 12,
  },
  chartHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.textPrimary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10, color: Colors.light.textSecondary, marginRight: 4 },

  historyList: { borderRadius: 14, overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  historyIndicator: {
    width: 4, height: 36, borderRadius: 2,
  },
  historyDate:    { fontSize: 12, color: Colors.light.textSecondary },
  historyNotes:   { fontSize: 11, color: Colors.light.textMuted, marginTop: 2, fontStyle: 'italic' },
  historyThumb:   { width: 52, height: 52, borderRadius: 8, marginRight: 4 },
  historyValWrap: { alignItems: 'flex-end', gap: 2 },
  historyVal:     { fontSize: 18, fontWeight: '700' },
  historyUnit:    { fontSize: 10, color: Colors.light.textMuted },
  empty: {
    textAlign: 'center', color: Colors.light.textMuted, fontSize: 13, paddingVertical: 20,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalImage:  { width: width - 40, height: width - 40, borderRadius: 12 },
  modalClose:  {
    marginTop: 18, color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.85,
  },
})
