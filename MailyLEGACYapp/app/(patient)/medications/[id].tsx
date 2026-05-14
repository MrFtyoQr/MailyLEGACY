/**
 * (patient)/medications/[id].tsx
 * Detalle de un medicamento: info + historial de tomas + acciones.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Skeleton } from '@components/ui/Skeleton'
import { Colors } from '@constants/colors'
import { get } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import { useMedication, useTakeMedication, useSkipMedication } from '@hooks/useMedications'

interface Schedule {
  id:           string
  time_of_day:  string
  day_of_week:  string | null
}

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const { data: med,       isLoading: loadingMed       } = useMedication(id)
  const { data: schedules, isLoading: loadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['medications', id, 'schedules'],
    queryFn:  () => get<Schedule[]>(EP.medicationSchedules(id)),
    enabled:  !!id,
    staleTime: 5 * 60 * 1000,
  })

  const takeMed = useTakeMedication()
  const skipMed = useSkipMedication()

  async function handleTake(historyId: string) {
    setLoadingAction(historyId)
    try {
      await takeMed.mutateAsync(historyId)
      Alert.alert('✅ Registrado', 'Medicamento marcado como tomado.')
    } catch {
      Alert.alert('Error', 'No se pudo registrar. Intenta de nuevo.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleSkip(historyId: string) {
    Alert.alert(
      'Saltar medicamento',
      '¿Estás seguro de que quieres saltar esta dosis?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Saltar',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction(historyId)
            try {
              await skipMed.mutateAsync(historyId)
            } catch {
              Alert.alert('Error', 'No se pudo registrar. Intenta de nuevo.')
            } finally {
              setLoadingAction(null)
            }
          },
        },
      ],
    )
  }

  if (loadingMed) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
        </View>
        <Skeleton height={140} borderRadius={16} style={{ marginBottom: 12 }} />
        <Skeleton height={80}  borderRadius={16} />
      </ScreenWrapper>
    )
  }

  if (!med) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.errorText}>No se encontró el medicamento.</Text>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Info principal */}
        <Card>
          <View style={styles.medHeader}>
            <Text style={styles.medEmoji}>💊</Text>
            <View style={styles.medInfo}>
              <Text style={styles.medName}>{med.name}</Text>
              <Text style={styles.medDose}>{med.dose}</Text>
            </View>
            <Badge
              label={med.is_active ? 'Activo' : 'Inactivo'}
              variant={med.is_active ? 'success' : 'neutral'}
              size="sm"
            />
          </View>

          <View style={styles.divider} />

          <InfoRow label="Frecuencia"  value={med.frequency} />
          <InfoRow label="Inicio"      value={formatDate(med.start_date)} />
          {med.end_date && (
            <InfoRow label="Fin"       value={formatDate(med.end_date)} />
          )}
          {med.instructions && (
            <InfoRow label="Instrucciones" value={med.instructions} />
          )}
        </Card>

        {/* Horarios */}
        {!loadingSchedules && schedules && schedules.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Horario programado</Text>
            <Card>
              {schedules.map((s, idx) => (
                <View key={s.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleIcon}>⏰</Text>
                    <Text style={styles.scheduleTime}>{s.time_of_day}</Text>
                    {s.day_of_week && (
                      <Text style={styles.scheduleDay}>{s.day_of_week}</Text>
                    )}
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Info adicional sobre tomar/saltar */}
        {med.is_active && (
          <Card style={styles.actionHint}>
            <Text style={styles.actionHintText}>
              💡 Para registrar una toma, usa la vista "Hoy" en la pestaña de Medicamentos.
            </Text>
          </Card>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value}</Text>
    </View>
  )
}

const ir = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  label: { fontSize: 14, color: Colors.light.textSecondary, flex: 1 },
  value: { fontSize: 14, color: Colors.light.textPrimary, fontWeight: '500', flex: 2, textAlign: 'right' },
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

const styles = StyleSheet.create({
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 12,
  },
  back: {
    fontSize:  17,
    color:     Colors.brand.primary,
    fontWeight: '600',
    minWidth:  64,
  },
  headerTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  content: {
    gap:           16,
    paddingBottom: 24,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  medEmoji: { fontSize: 36 },
  medInfo:  { flex: 1 },
  medName:  { fontSize: 18, fontWeight: '700', color: Colors.light.textPrimary },
  medDose:  { fontSize: 14, color: Colors.light.textSecondary, marginTop: 2 },
  divider:  { height: 1, backgroundColor: Colors.light.border, marginVertical: 8 },
  sectionTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    paddingVertical: 6,
  },
  scheduleIcon: { fontSize: 18 },
  scheduleTime: { fontSize: 15, fontWeight: '600', color: Colors.light.textPrimary, flex: 1 },
  scheduleDay:  { fontSize: 13, color: Colors.light.textSecondary },
  actionHint: {
    backgroundColor: Colors.light.surface,
  },
  actionHintText: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    lineHeight: 18,
  },
  errorText: {
    fontSize:  15,
    color:     Colors.semantic.error,
    textAlign: 'center',
    marginTop: 40,
  },
})
