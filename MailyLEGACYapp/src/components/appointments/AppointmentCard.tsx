/**
 * AppointmentCard.tsx
 * Card de cita médica con estado y acciones opcionales.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { Colors } from '@constants/colors'
import type { Appointment } from '@hooks/useAppointments'

interface AppointmentCardProps {
  appointment: Appointment
  onPress?:    () => void
}

const STATUS_BADGE: Record<Appointment['status'], { label: string; variant: 'info' | 'success' | 'neutral' | 'error' | 'warning' }> = {
  PENDING:   { label: 'Pendiente',  variant: 'warning' },
  CONFIRMED: { label: 'Confirmada', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'success' },
  CANCELLED: { label: 'Cancelada',  variant: 'error' },
}

export function AppointmentCard({ appointment, onPress }: AppointmentCardProps) {
  const scheduled = new Date(appointment.scheduled_at)
  const dateStr = scheduled.toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short',
  })
  const timeStr = scheduled.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  })

  const { label, variant } = STATUS_BADGE[appointment.status]

  const Wrapper = onPress ? TouchableOpacity : View

  return (
    <Wrapper onPress={onPress} activeOpacity={0.75} style={styles.wrapper}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.dateBox}>
            <Text style={styles.time}>{timeStr}</Text>
            <Text style={styles.dateStr}>{dateStr}</Text>
          </View>
          <Badge label={label} variant={variant} size="sm" />
        </View>

        <View style={styles.divider} />

        <Text style={styles.doctorName} numberOfLines={1}>
          {appointment.doctor_name}
        </Text>
        <Text style={styles.specialty} numberOfLines={1}>
          {appointment.specialty}
        </Text>

        {appointment.location && (
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.location} numberOfLines={1}>
              {appointment.location}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.duration}>⏱ {appointment.duration_min} min</Text>
          {onPress && (
            <Text style={styles.chevron}>›</Text>
          )}
        </View>
      </Card>
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    padding: 14,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   10,
  },
  dateBox: {
    gap: 2,
  },
  time: {
    fontSize:   17,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  dateStr: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    textTransform: 'capitalize',
  },
  divider: {
    height:          1,
    backgroundColor: Colors.light.border,
    marginBottom:    10,
  },
  doctorName: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  specialty: {
    fontSize:  13,
    color:     Colors.light.textSecondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     8,
    gap:           4,
  },
  locationIcon: {
    fontSize: 13,
  },
  location: {
    fontSize: 13,
    color:    Colors.light.textSecondary,
    flex:     1,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      10,
  },
  duration: {
    fontSize: 13,
    color:    Colors.light.textMuted,
  },
  chevron: {
    fontSize:   20,
    color:      Colors.light.textMuted,
    lineHeight: 22,
  },
})
