/**
 * (patient)/vitals/index.tsx
 * Historial de signos vitales del paciente + resumen.
 */

import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { VitalCard } from '@components/vitals/VitalCard'
import { Colors } from '@constants/colors'
import { useVitals, useVitalsSummary } from '@hooks/useVitals'

export default function VitalsScreen() {
  const { data: vitals, isLoading, isError, refetch } = useVitals()
  const { data: summary } = useVitalsSummary()

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Signos Vitales</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(patient)/vitals/add')}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>+ Registrar</Text>
        </TouchableOpacity>
      </View>

      {/* Resumen */}
      {summary && (
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Promedios (últimos registros)</Text>
          <View style={styles.summaryRow}>
            {summary.avg_heart_rate != null && (
              <SummaryChip icon="❤️" label="FC" value={`${Math.round(summary.avg_heart_rate)}`} unit="lpm" />
            )}
            {summary.avg_glucose != null && (
              <SummaryChip icon="🩸" label="Glucosa" value={`${Math.round(summary.avg_glucose)}`} unit="mg/dL" />
            )}
            {summary.avg_systolic != null && summary.avg_diastolic != null && (
              <SummaryChip
                icon="💉"
                label="PA"
                value={`${Math.round(summary.avg_systolic)}/${Math.round(summary.avg_diastolic)}`}
                unit="mmHg"
              />
            )}
          </View>
          <Text style={styles.summaryTotal}>
            {summary.total_records} {summary.total_records === 1 ? 'registro' : 'registros'} totales
          </Text>
        </Card>
      )}

      {/* Lista */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Error al cargar vitales</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vitals ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VitalCard entry={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="📊"
              title="Sin registros"
              subtitle="Registra tus primeros signos vitales para ver tu historial aquí."
              actionLabel="Registrar ahora"
              onAction={() => router.push('/(patient)/vitals/add')}
            />
          }
        />
      )}
    </ScreenWrapper>
  )
}

function SummaryChip({
  icon, label, value, unit,
}: { icon: string; label: string; value: string; unit: string }) {
  return (
    <View style={sc.chip}>
      <Text style={sc.icon}>{icon}</Text>
      <Text style={sc.label}>{label}</Text>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.unit}>{unit}</Text>
    </View>
  )
}

const sc = StyleSheet.create({
  chip:  { alignItems: 'center', flex: 1, gap: 2 },
  icon:  { fontSize: 18 },
  label: { fontSize: 11, color: Colors.light.textMuted },
  value: { fontSize: 16, fontWeight: '700', color: Colors.light.textPrimary },
  unit:  { fontSize: 10, color: Colors.light.textMuted },
})

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
  },
  addBtnText: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '600',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom:     16,
  },
  summaryTitle: {
    fontSize:     12,
    color:        Colors.light.textMuted,
    fontWeight:   '500',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryTotal: {
    marginTop:  10,
    fontSize:   12,
    color:      Colors.light.textMuted,
    textAlign:  'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom:     100,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  errorText: {
    fontSize: 15,
    color:    Colors.semantic.error,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical:   8,
    borderRadius:      8,
    backgroundColor:   Colors.light.surface,
  },
  retryText: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.brand.primary,
  },
})
