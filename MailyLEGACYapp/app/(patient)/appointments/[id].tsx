/**
 * (patient)/appointments/[id].tsx
 * Detalle de cita + botón cancelar.
 */

import React from 'react'
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
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Skeleton } from '@components/ui/Skeleton'
import { Button } from '@components/ui/Button'
import { Colors } from '@constants/colors'
import { useAppointment, useCancelAppointment, type Appointment } from '@hooks/useAppointments'

const STATUS_BADGE: Record<Appointment['status'], { label: string; variant: 'info' | 'success' | 'neutral' | 'error' | 'warning' }> = {
  PENDING:   { label: 'Pendiente',  variant: 'warning' },
  CONFIRMED: { label: 'Confirmada', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'success' },
  CANCELLED: { label: 'Cancelada',  variant: 'error' },
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: appt, isLoading } = useAppointment(id)
  const cancelAppt = useCancelAppointment()

  function handleCancel() {
    Alert.alert(
      'Cancelar cita',
      '¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer.',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAppt.mutateAsync(id)
              Alert.alert('Cita cancelada', 'Tu cita ha sido cancelada correctamente.', [
                { text: 'OK', onPress: () => router.back() },
              ])
            } catch {
              Alert.alert('Error', 'No se pudo cancelar. Intenta de nuevo o contacta a tu médico.')
            }
          },
        },
      ],
    )
  }

  if (isLoading) {
    return (
      <ScreenWrapper>
        <Header />
        <Skeleton height={200} borderRadius={16} style={{ marginBottom: 12 }} />
        <Skeleton height={80}  borderRadius={16} />
      </ScreenWrapper>
    )
  }

  if (!appt) {
    return (
      <ScreenWrapper>
        <Header />
        <Text style={styles.notFound}>No se encontró la cita.</Text>
      </ScreenWrapper>
    )
  }

  const scheduled = new Date(appt.scheduled_at)
  const { label, variant } = STATUS_BADGE[appt.status]
  const canCancel = appt.status === 'PENDING' || appt.status === 'CONFIRMED'

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      <Header />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Status */}
        <View style={styles.statusRow}>
          <Text style={styles.apptTitle}>Cita médica</Text>
          <Badge label={label} variant={variant} />
        </View>

        {/* Fecha y hora */}
        <Card style={styles.dateCard}>
          <View style={styles.dateRow}>
            <Text style={styles.dateEmoji}>📅</Text>
            <View>
              <Text style={styles.dateDay}>
                {scheduled.toLocaleDateString('es-MX', {
                  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                })}
              </Text>
              <Text style={styles.dateTime}>
                {scheduled.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {appt.duration_min} minutos
              </Text>
            </View>
          </View>
        </Card>

        {/* Doctor */}
        <Card>
          <Text style={styles.sectionLabel}>Médico</Text>
          <Text style={styles.doctorName}>{appt.doctor_name}</Text>
          <Text style={styles.specialty}>{appt.specialty}</Text>
        </Card>

        {/* Ubicación */}
        {appt.location && (
          <Card>
            <Text style={styles.sectionLabel}>Ubicación</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.location}>{appt.location}</Text>
            </View>
          </Card>
        )}

        {/* Notas */}
        {appt.notes && (
          <Card>
            <Text style={styles.sectionLabel}>Notas</Text>
            <Text style={styles.notes}>{appt.notes}</Text>
          </Card>
        )}

        {/* Cancelar */}
        {canCancel && (
          <Button
            label={cancelAppt.isPending ? 'Cancelando…' : 'Cancelar cita'}
            onPress={handleCancel}
            disabled={cancelAppt.isPending}
            variant="danger"
          />
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </ScreenWrapper>
  )
}

function Header() {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.back}>‹ Volver</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Detalle de cita</Text>
      <View style={{ width: 64 }} />
    </View>
  )
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
  statusRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  apptTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  dateCard: { padding: 16 },
  dateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  dateEmoji: { fontSize: 32 },
  dateDay: {
    fontSize:      16,
    fontWeight:    '700',
    color:         Colors.light.textPrimary,
    textTransform: 'capitalize',
  },
  dateTime: {
    fontSize:  14,
    color:     Colors.light.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize:      12,
    fontWeight:    '600',
    color:         Colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  6,
  },
  doctorName: {
    fontSize:   17,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  specialty: {
    fontSize:  14,
    color:     Colors.light.textSecondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  locationIcon: { fontSize: 16 },
  location: {
    fontSize:   15,
    color:      Colors.light.textPrimary,
    flex:       1,
  },
  notes: {
    fontSize:   14,
    color:      Colors.light.textSecondary,
    lineHeight: 20,
  },
  notFound: {
    fontSize:  15,
    color:     Colors.semantic.error,
    textAlign: 'center',
    marginTop: 40,
  },
})
